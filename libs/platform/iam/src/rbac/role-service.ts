import type { AuditService } from '@erp/platform-audit';
import { runInTenantContext, TenantDb, type TenantTransaction } from '@erp/platform-tenancy';
import type { AssignRoles, CreateRole, UpdateRole } from '@erp/shared-contracts';
import {
  ConcurrencyConflictError,
  DomainError,
  NotFoundError,
  type EntityId,
} from '@erp/shared-kernel';
import type { PermissionCatalog } from './permission-catalog';
import type { PermissionRepository, RoleRecord } from './permission-repository';
import type { PermissionService } from './permission-service';

export const ROLE_IS_SYSTEM = 'ROLE_IS_SYSTEM';
export const PERMISSION_UNKNOWN = 'PERMISSION_UNKNOWN';

/** Módulo e entidade como aparecem na trilha de auditoria. */
export const ROLE_AUDIT_MODULE = 'platform';
export const ROLE_AUDIT_ENTITY = 'role';

/**
 * Regras de papel.
 *
 * Fica entre o controller e o repositório porque quatro coisas precisam andar juntas: a
 * versão otimista, a proteção dos papéis do sistema, o registro de auditoria — na mesma
 * transação da escrita — e a invalidação do cache de permissões, que só acontece depois
 * do commit.
 */
export class RoleService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly repository: PermissionRepository,
    private readonly permissions: PermissionService,
    private readonly catalog: PermissionCatalog,
    private readonly audit: AuditService,
  ) {}

  list(tenantId: EntityId): Promise<readonly RoleRecord[]> {
    return this.inTenant(tenantId, (tx) => this.repository.listRoles(tx));
  }

  async create(tenantId: EntityId, input: CreateRole, actorUserId: EntityId): Promise<RoleRecord> {
    this.assertKnownPermissions(input.permissions);

    const created = await this.inTenant(tenantId, async (tx) => {
      const roleId = await this.repository.createRole(tx, input, actorUserId);
      const role = await this.requireIn(tx, roleId);

      await this.audit.record(tx, {
        module: ROLE_AUDIT_MODULE,
        entity: ROLE_AUDIT_ENTITY,
        entityId: roleId,
        action: 'CREATE',
        userId: actorUserId,
        before: null,
        after: snapshotOf(role),
      });

      return role;
    });

    this.permissions.invalidateTenant(tenantId);
    return created;
  }

  async update(
    tenantId: EntityId,
    roleId: EntityId,
    input: UpdateRole,
    actorUserId: EntityId,
  ): Promise<RoleRecord> {
    const updated = await this.inTenant(tenantId, async (tx) => {
      const current = await this.requireIn(tx, roleId);

      if (current.version !== input.version) {
        throw new ConcurrencyConflictError('Papel', input.version, current.version);
      }
      if (input.permissions !== undefined) {
        this.assertKnownPermissions(input.permissions);
      }

      await this.repository.updateRole(tx, roleId, input, actorUserId);
      const next = await this.requireIn(tx, roleId);

      await this.audit.record(tx, {
        module: ROLE_AUDIT_MODULE,
        entity: ROLE_AUDIT_ENTITY,
        entityId: roleId,
        action: 'UPDATE',
        userId: actorUserId,
        before: snapshotOf(current),
        after: snapshotOf(next),
      });

      return next;
    });

    this.permissions.invalidateTenant(tenantId);
    return updated;
  }

  async remove(tenantId: EntityId, roleId: EntityId, actorUserId: EntityId): Promise<void> {
    await this.inTenant(tenantId, async (tx) => {
      const current = await this.requireIn(tx, roleId);
      // docs/dominio/platform.md: papel semeado não pode ser excluído. Renomear e ajustar
      // permissões, sim — é assim que o tenant adapta os papéis à sua realidade.
      if (current.isSystem) {
        throw new DomainError(ROLE_IS_SYSTEM, 'Papel do sistema não pode ser excluído.', {
          role: current.name,
        });
      }

      await this.repository.deleteRole(tx, roleId);
      await this.audit.record(tx, {
        module: ROLE_AUDIT_MODULE,
        entity: ROLE_AUDIT_ENTITY,
        entityId: roleId,
        action: 'DELETE',
        userId: actorUserId,
        before: snapshotOf(current),
        after: null,
      });
    });

    this.permissions.invalidateTenant(tenantId);
  }

  listMembershipRoles(tenantId: EntityId, membershipId: EntityId): Promise<readonly EntityId[]> {
    return this.inTenant(tenantId, (tx) => this.repository.listMembershipRoles(tx, membershipId));
  }

  async assignRoles(
    tenantId: EntityId,
    membershipId: EntityId,
    input: AssignRoles,
    actorUserId?: EntityId,
  ): Promise<readonly EntityId[]> {
    const assigned = await this.inTenant(tenantId, async (tx) => {
      const existing = new Set((await this.repository.listRoles(tx)).map((role) => role.id));
      for (const roleId of input.roleIds) {
        if (!existing.has(roleId)) {
          throw new NotFoundError('Papel', roleId);
        }
      }

      const before = await this.repository.listMembershipRoles(tx, membershipId);
      await this.repository.setMembershipRoles(tx, membershipId, input.roleIds);

      await this.audit.record(tx, {
        module: ROLE_AUDIT_MODULE,
        entity: 'membership',
        entityId: membershipId,
        action: 'UPDATE',
        ...(actorUserId === undefined ? {} : { userId: actorUserId }),
        before: { roleIds: [...before] },
        after: { roleIds: [...input.roleIds] },
      });

      return input.roleIds;
    });

    this.permissions.invalidateTenant(tenantId);
    return assigned;
  }

  /** Usado pelo provisionamento de um tenant novo (F0-11). */
  async seedSystemRoles(tenantId: EntityId): Promise<void> {
    await this.inTenant(tenantId, (tx) => this.repository.seedSystemRoles(tx, this.catalog));
    this.permissions.invalidateTenant(tenantId);
  }

  findSystemRoleByName(tenantId: EntityId, name: string): Promise<EntityId | undefined> {
    return this.inTenant(tenantId, (tx) => this.repository.findSystemRoleByName(tx, name));
  }

  private inTenant<T>(tenantId: EntityId, fn: (tx: TenantTransaction) => Promise<T>): Promise<T> {
    return runInTenantContext({ tenantId }, () => this.tenantDb.withTenantTx(fn));
  }

  private async requireIn(tx: TenantTransaction, roleId: EntityId): Promise<RoleRecord> {
    const role = await this.repository.findRole(tx, roleId);
    if (role === undefined) {
      throw new NotFoundError('Papel', roleId);
    }
    return role;
  }

  /** Permissão que não está no catálogo é erro de digitação, não permissão futura. */
  private assertKnownPermissions(permissions: readonly string[]): void {
    const unknown = permissions.filter((permission) => !this.catalog.has(permission));
    if (unknown.length > 0) {
      throw new DomainError(
        PERMISSION_UNKNOWN,
        `Permissões desconhecidas: ${unknown.join(', ')}.`,
        {
          unknown,
        },
      );
    }
  }
}

/** O que vai para a auditoria. Sem `version`: ela muda em toda alteração e só faz ruído. */
function snapshotOf(role: RoleRecord): Record<string, unknown> {
  return {
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: [...role.permissions],
  };
}
