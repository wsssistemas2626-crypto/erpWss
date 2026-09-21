import {
  ConcurrencyConflictError,
  DomainError,
  NotFoundError,
  type EntityId,
} from '@erp/shared-kernel';
import type { AssignRoles, CreateRole, UpdateRole } from '@erp/shared-contracts';
import type { PermissionCatalog } from './permission-catalog';
import type { PermissionRepository, RoleRecord } from './permission-repository';
import type { PermissionService } from './permission-service';

export const ROLE_IS_SYSTEM = 'ROLE_IS_SYSTEM';
export const PERMISSION_UNKNOWN = 'PERMISSION_UNKNOWN';

/**
 * Regras de papel. Fica entre o controller e o repositório porque três coisas precisam
 * andar juntas: a versão otimista, a proteção dos papéis do sistema e a invalidação do
 * cache de permissões — esquecer a última deixaria o usuário 60 s com o acesso antigo.
 */
export class RoleService {
  constructor(
    private readonly repository: PermissionRepository,
    private readonly permissions: PermissionService,
    private readonly catalog: PermissionCatalog,
  ) {}

  list(tenantId: EntityId): Promise<readonly RoleRecord[]> {
    return this.repository.listRoles(tenantId);
  }

  async create(tenantId: EntityId, input: CreateRole, actorUserId: EntityId): Promise<RoleRecord> {
    this.assertKnownPermissions(input.permissions);
    const role = await this.repository.createRole(tenantId, input, actorUserId);
    this.permissions.invalidateTenant(tenantId);
    return role;
  }

  async update(
    tenantId: EntityId,
    roleId: EntityId,
    input: UpdateRole,
    actorUserId: EntityId,
  ): Promise<RoleRecord> {
    const current = await this.require(tenantId, roleId);

    if (current.version !== input.version) {
      throw new ConcurrencyConflictError('Papel', input.version, current.version);
    }
    if (current.isSystem && input.name !== undefined && input.name !== current.name) {
      throw new DomainError(ROLE_IS_SYSTEM, 'Papel do sistema não pode ser renomeado.', {
        role: current.name,
      });
    }
    if (input.permissions !== undefined) {
      this.assertKnownPermissions(input.permissions);
    }

    await this.repository.updateRole(tenantId, roleId, input, actorUserId);
    this.permissions.invalidateTenant(tenantId);

    return this.require(tenantId, roleId);
  }

  async remove(tenantId: EntityId, roleId: EntityId): Promise<void> {
    const current = await this.require(tenantId, roleId);
    if (current.isSystem) {
      throw new DomainError(ROLE_IS_SYSTEM, 'Papel do sistema não pode ser excluído.', {
        role: current.name,
      });
    }

    await this.repository.deleteRole(tenantId, roleId);
    this.permissions.invalidateTenant(tenantId);
  }

  listMembershipRoles(tenantId: EntityId, membershipId: EntityId): Promise<readonly EntityId[]> {
    return this.repository.listMembershipRoles(tenantId, membershipId);
  }

  async assignRoles(
    tenantId: EntityId,
    membershipId: EntityId,
    input: AssignRoles,
  ): Promise<readonly EntityId[]> {
    const existing = new Set((await this.repository.listRoles(tenantId)).map((role) => role.id));
    for (const roleId of input.roleIds) {
      if (!existing.has(roleId)) {
        throw new NotFoundError('Papel', roleId);
      }
    }

    await this.repository.setMembershipRoles(tenantId, membershipId, input.roleIds);
    this.permissions.invalidateTenant(tenantId);

    return input.roleIds;
  }

  seedSystemRoles(tenantId: EntityId): Promise<void> {
    return this.repository.seedSystemRoles(tenantId, this.catalog);
  }

  findSystemRoleByName(tenantId: EntityId, name: string): Promise<EntityId | undefined> {
    return this.repository.findSystemRoleByName(tenantId, name);
  }

  private async require(tenantId: EntityId, roleId: EntityId): Promise<RoleRecord> {
    const role = await this.repository.findRole(tenantId, roleId);
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
        { unknown },
      );
    }
  }
}
