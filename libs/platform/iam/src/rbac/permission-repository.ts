import { runInTenantContext, TenantDb } from '@erp/platform-tenancy';
import { newId, type EntityId } from '@erp/shared-kernel';
import type { PermissionCatalog } from './permission-catalog';
import { ADMINISTRATOR_ROLE, SYSTEM_ROLES } from './system-roles';

export interface RoleRecord {
  readonly id: EntityId;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly version: number;
  readonly permissions: readonly string[];
}

/** Leitura e escrita de papéis. Tudo dentro da transação do tenant (RLS). */
export class PermissionRepository {
  constructor(private readonly tenantDb: TenantDb) {}

  /** A consulta quente do guard: todas as permissões de um membership. */
  async findPermissionsByMembership(
    tenantId: EntityId,
    membershipId: EntityId,
  ): Promise<readonly string[]> {
    return runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const result = await tx.client.query<{ permission: string }>(
          `select distinct rp.permission
             from platform.membership_roles mr
             join platform.role_permissions rp on rp.role_id = mr.role_id
            where mr.membership_id = $1
            order by rp.permission`,
          [membershipId],
        );
        return result.rows.map((row) => row.permission);
      }),
    );
  }

  async listRoles(tenantId: EntityId): Promise<readonly RoleRecord[]> {
    return runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const result = await tx.client.query<{
          id: string;
          name: string;
          description: string | null;
          is_system: boolean;
          version: number;
          permissions: string[] | null;
        }>(
          `select r.id, r.name, r.description, r.is_system, r.version,
                  array_remove(array_agg(rp.permission order by rp.permission), null) as permissions
             from platform.roles r
             left join platform.role_permissions rp on rp.role_id = r.id
            group by r.id
            order by r.name`,
        );
        return result.rows.map(toRoleRecord);
      }),
    );
  }

  async findRole(tenantId: EntityId, roleId: EntityId): Promise<RoleRecord | undefined> {
    const roles = await this.listRoles(tenantId);
    return roles.find((role) => role.id === roleId);
  }

  async createRole(
    tenantId: EntityId,
    input: { name: string; description?: string; permissions: readonly string[] },
    actorUserId: EntityId,
  ): Promise<RoleRecord> {
    const roleId = newId();
    await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        await tx.client.query(
          `insert into platform.roles (id, tenant_id, name, description, created_by, updated_by)
           values ($1, $2, $3, $4, $5, $5)`,
          [roleId, tenantId, input.name, input.description ?? null, actorUserId],
        );
        await insertPermissions(tx.client, tenantId, roleId, input.permissions);
      }),
    );

    const created = await this.findRole(tenantId, roleId);
    if (created === undefined) {
      throw new Error('Papel recém-criado não foi encontrado.');
    }
    return created;
  }

  /** Atualiza nome, descrição e permissões numa transação só, bumpando a versão. */
  async updateRole(
    tenantId: EntityId,
    roleId: EntityId,
    input: { name?: string; description?: string | null; permissions?: readonly string[] },
    actorUserId: EntityId,
  ): Promise<void> {
    await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        await tx.client.query(
          `update platform.roles
              set name = coalesce($2, name),
                  description = case when $3::boolean then $4 else description end,
                  updated_at = now(),
                  updated_by = $5,
                  version = version + 1
            where id = $1`,
          [
            roleId,
            input.name ?? null,
            input.description !== undefined,
            input.description ?? null,
            actorUserId,
          ],
        );

        if (input.permissions !== undefined) {
          await tx.client.query('delete from platform.role_permissions where role_id = $1', [
            roleId,
          ]);
          await insertPermissions(tx.client, tenantId, roleId, input.permissions);
        }
      }),
    );
  }

  async deleteRole(tenantId: EntityId, roleId: EntityId): Promise<void> {
    await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        await tx.client.query('delete from platform.roles where id = $1', [roleId]);
      }),
    );
  }

  async listMembershipRoles(
    tenantId: EntityId,
    membershipId: EntityId,
  ): Promise<readonly EntityId[]> {
    return runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const result = await tx.client.query<{ role_id: string }>(
          'select role_id from platform.membership_roles where membership_id = $1',
          [membershipId],
        );
        return result.rows.map((row) => row.role_id);
      }),
    );
  }

  async setMembershipRoles(
    tenantId: EntityId,
    membershipId: EntityId,
    roleIds: readonly EntityId[],
  ): Promise<void> {
    await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        await tx.client.query('delete from platform.membership_roles where membership_id = $1', [
          membershipId,
        ]);
        for (const roleId of roleIds) {
          await tx.client.query(
            `insert into platform.membership_roles (tenant_id, membership_id, role_id)
             values ($1, $2, $3)`,
            [tenantId, membershipId, roleId],
          );
        }
      }),
    );
  }

  /**
   * Semeia os papéis do sistema num tenant novo (usado pelo F0-11).
   * Idempotente: rodar de novo apenas atualiza as permissões a partir do catálogo.
   */
  async seedSystemRoles(tenantId: EntityId, catalog: PermissionCatalog): Promise<void> {
    await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        for (const role of SYSTEM_ROLES) {
          const existing = await tx.client.query<{ id: string }>(
            'select id from platform.roles where name = $1',
            [role.name],
          );

          const roleId = existing.rows[0]?.id ?? newId();
          if (existing.rows[0] === undefined) {
            await tx.client.query(
              `insert into platform.roles (id, tenant_id, name, description, is_system)
               values ($1, $2, $3, $4, true)`,
              [roleId, tenantId, role.name, role.description],
            );
          }

          await tx.client.query('delete from platform.role_permissions where role_id = $1', [
            roleId,
          ]);
          await insertPermissions(
            tx.client,
            tenantId,
            roleId,
            catalog.keysForRole(role.name, role.name === ADMINISTRATOR_ROLE),
          );
        }
      }),
    );
  }

  /** Papel do sistema pelo nome — usado para dar `Administrador` a quem cria o tenant. */
  async findSystemRoleByName(tenantId: EntityId, name: string): Promise<EntityId | undefined> {
    return runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const result = await tx.client.query<{ id: string }>(
          'select id from platform.roles where name = $1',
          [name],
        );
        return result.rows[0]?.id;
      }),
    );
  }
}

interface PgClientLike {
  query(text: string, values?: unknown[]): Promise<unknown>;
}

async function insertPermissions(
  client: PgClientLike,
  tenantId: EntityId,
  roleId: EntityId,
  permissions: readonly string[],
): Promise<void> {
  for (const permission of permissions) {
    await client.query(
      `insert into platform.role_permissions (tenant_id, role_id, permission)
       values ($1, $2, $3)
       on conflict do nothing`,
      [tenantId, roleId, permission],
    );
  }
}

function toRoleRecord(row: {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  version: number;
  permissions: string[] | null;
}): RoleRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.is_system,
    version: row.version,
    permissions: row.permissions ?? [],
  };
}
