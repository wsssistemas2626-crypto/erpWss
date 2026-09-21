import type { EntityId } from '@erp/shared-kernel';
import { runInTenantContext, TenantDb } from '@erp/platform-tenancy';
import type { Pool } from 'pg';
import type {
  AuthenticatedTenant,
  AuthenticatedUser,
  MembershipStatus,
  TenantStatus,
} from '../auth-context';

export interface MembershipRecord {
  readonly id: EntityId;
  readonly status: MembershipStatus;
}

/**
 * Leituras que a autenticação precisa fazer a cada requisição.
 *
 * `tenants` e `users` são globais e não têm RLS — são lidos direto do pool. `memberships`
 * tem `tenant_id` e RLS, então só é lido dentro da transação do tenant, o que só é possível
 * depois de resolver o tenant pelo `clerk_org_id`. Essa ordem não é detalhe: é o que permite
 * a tabela de vínculos ficar sob a mesma política das demais.
 */
export class IdentityRepository {
  constructor(
    private readonly pool: Pool,
    private readonly tenantDb: TenantDb,
  ) {}

  async findUserByExternalId(externalUserId: string): Promise<AuthenticatedUser | undefined> {
    const result = await this.pool.query<{
      id: string;
      clerk_user_id: string;
      email: string;
      name: string;
      status: string;
    }>(
      `select id, clerk_user_id, email, name, status
         from platform.users
        where clerk_user_id = $1 and status = 'ACTIVE'`,
      [externalUserId],
    );

    const row = result.rows[0];
    if (row === undefined) {
      return undefined;
    }
    return { id: row.id, externalId: row.clerk_user_id, email: row.email, name: row.name };
  }

  async findTenantByExternalId(
    externalOrganizationId: string,
  ): Promise<AuthenticatedTenant | undefined> {
    const result = await this.pool.query<{
      id: string;
      clerk_org_id: string;
      name: string;
      slug: string;
      status: TenantStatus;
    }>(
      `select id, clerk_org_id, name, slug, status
         from platform.tenants
        where clerk_org_id = $1`,
      [externalOrganizationId],
    );

    const row = result.rows[0];
    if (row === undefined) {
      return undefined;
    }
    return {
      id: row.id,
      externalId: row.clerk_org_id,
      name: row.name,
      slug: row.slug,
      status: row.status,
    };
  }

  findMembership(tenantId: EntityId, userId: EntityId): Promise<MembershipRecord | undefined> {
    return runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const result = await tx.client.query<{ id: string; status: MembershipStatus }>(
          'select id, status from platform.memberships where user_id = $1',
          [userId],
        );
        return result.rows[0];
      }),
    );
  }
}
