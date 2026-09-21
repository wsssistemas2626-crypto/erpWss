import type { AuditService } from '@erp/platform-audit';
import { runInTenantContext, TenantDb, type TenantTransaction } from '@erp/platform-tenancy';
import { newId, type EntityId } from '@erp/shared-kernel';
import type { Pool } from 'pg';
import type { RoleService } from '../rbac/role-service';
import { ADMINISTRATOR_ROLE } from '../rbac/system-roles';
import type { IdentityWebhookEvent } from './webhook-event';

export const DEFAULT_MEMBER_ROLE = 'Membro de Equipe';
/** Papel de organização do Clerk que ganha `Administrador` no provisionamento (ADR-004). */
export const CLERK_ADMIN_ROLE = 'org:admin';

export type SyncOutcome = 'applied' | 'ignored';

export interface SyncedTenant {
  readonly id: EntityId;
  readonly created: boolean;
}

/**
 * Espelha o Clerk no banco local (ADR-004).
 *
 * Duas portas de entrada levam aqui: o webhook e o provisionamento sob demanda. Por isso
 * cada operação é um upsert idempotente — a mesma organização pode chegar pelos dois
 * caminhos, em qualquer ordem, e o resultado tem de ser o mesmo.
 *
 * Nada é apagado: usuário excluído vira `DELETED` e vínculo removido vira `REVOKED`, para
 * que `created_by` e a auditoria continuem apontando para alguém.
 */
export class IdentitySyncService {
  /**
   * @param pool conexão da aplicação (`app_user`), para as tabelas globais.
   * @param platformPool conexão `app_platform`, só para as duas buscas que precisam
   *   atravessar tenants: achar o tenant de um vínculo e os vínculos de um usuário.
   */
  constructor(
    private readonly pool: Pool,
    private readonly platformPool: Pool,
    private readonly tenantDb: TenantDb,
    private readonly roles: RoleService,
    private readonly audit: AuditService,
  ) {}

  async apply(event: IdentityWebhookEvent): Promise<SyncOutcome> {
    const data = event.data;

    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        await this.upsertUser({
          externalId: String(data['id']),
          email: primaryEmailOf(data),
          name: nameOf(data),
        });
        return 'applied';

      case 'user.deleted':
        await this.markUserDeleted(String(data['id']));
        return 'applied';

      case 'organization.created':
      case 'organization.updated':
        await this.upsertTenant({
          externalId: String(data['id']),
          name: String(data['name'] ?? data['id']),
          slug: String(data['slug'] ?? data['id']),
        });
        return 'applied';

      case 'organization.deleted':
        await this.markTenantCancelled(String(data['id']));
        return 'applied';

      case 'organizationMembership.created':
      case 'organizationMembership.updated':
        await this.upsertMembership({
          externalId: String(data['id']),
          externalOrganizationId: String(
            (data['organization'] as Record<string, unknown> | undefined)?.['id'] ?? '',
          ),
          externalUserId: String(
            (
              (data['public_user_data'] ?? data['publicUserData']) as
                Record<string, unknown> | undefined
            )?.['user_id'] ?? '',
          ),
          clerkRole: String(data['role'] ?? ''),
        });
        return 'applied';

      case 'organizationMembership.deleted':
        await this.revokeMembership(String(data['id']));
        return 'applied';

      default:
        // Evento que não espelhamos. Responder 200 evita reentregas eternas do provedor.
        return 'ignored';
    }
  }

  async upsertUser(input: { externalId: string; email: string; name: string }): Promise<EntityId> {
    const result = await this.pool.query<{ id: string }>(
      `insert into platform.users (id, clerk_user_id, email, name)
       values ($1, $2, $3, $4)
       on conflict (clerk_user_id) do update
         set email = excluded.email,
             name = excluded.name,
             status = 'ACTIVE',
             updated_at = now()
       returning id`,
      [newId(), input.externalId, input.email, input.name],
    );
    return result.rows[0]?.id ?? '';
  }

  async markUserDeleted(externalUserId: string): Promise<void> {
    const user = await this.pool.query<{ id: string }>(
      `update platform.users set status = 'DELETED', updated_at = now()
        where clerk_user_id = $1
        returning id`,
      [externalUserId],
    );

    const userId = user.rows[0]?.id;
    if (userId === undefined) {
      return;
    }

    // A linha do usuário fica: created_by e a auditoria continuam apontando para ele.
    const tenants = await this.platformPool.query<{ tenant_id: string }>(
      'select distinct tenant_id from platform.memberships where user_id = $1',
      [userId],
    );
    for (const row of tenants.rows) {
      await this.revokeMembershipsOfUser(row.tenant_id, userId);
    }
  }

  async upsertTenant(input: {
    externalId: string;
    name: string;
    slug: string;
  }): Promise<SyncedTenant> {
    const existing = await this.pool.query<{ id: string; name: string; slug: string }>(
      'select id, name, slug from platform.tenants where clerk_org_id = $1',
      [input.externalId],
    );

    const known = existing.rows[0];
    if (known !== undefined) {
      if (known.name === input.name && known.slug === input.slug) {
        // Nada mudou: é só uma reentrega ou um acesso sob demanda. Sem UPDATE, sem auditoria.
        return { id: known.id, created: false };
      }

      await this.pool.query('update platform.tenants set name = $2, slug = $3 where id = $1', [
        known.id,
        input.name,
        input.slug,
      ]);
      await this.auditSystemAction(
        known.id,
        'tenant',
        known.id,
        'UPDATE',
        { name: input.name, slug: input.slug },
        { name: known.name, slug: known.slug },
      );
      return { id: known.id, created: false };
    }

    const created = await this.pool.query<{ id: string }>(
      `insert into platform.tenants (id, clerk_org_id, name, slug, status)
       values ($1, $2, $3, $4, 'ACTIVE')
       returning id`,
      [newId(), input.externalId, input.name, input.slug],
    );

    const tenantId = created.rows[0]?.id ?? '';
    // Tenant novo nasce com os papéis padrão (F0-08), senão ninguém consegue fazer nada nele.
    await this.roles.seedSystemRoles(tenantId);
    await this.auditSystemAction(tenantId, 'tenant', tenantId, 'CREATE', {
      name: input.name,
      slug: input.slug,
    });

    return { id: tenantId, created: true };
  }

  async markTenantCancelled(externalOrganizationId: string): Promise<void> {
    const updated = await this.pool.query<{ id: string; status: string }>(
      `update platform.tenants set status = 'CANCELLED'
        where clerk_org_id = $1 and status <> 'CANCELLED'
        returning id, status`,
      [externalOrganizationId],
    );

    const tenant = updated.rows[0];
    if (tenant === undefined) {
      return;
    }
    await this.auditSystemAction(
      tenant.id,
      'tenant',
      tenant.id,
      'UPDATE',
      { status: 'CANCELLED' },
      { status: 'ACTIVE' },
    );
  }

  async upsertMembership(input: {
    externalId: string;
    externalOrganizationId: string;
    externalUserId: string;
    clerkRole: string;
  }): Promise<EntityId | undefined> {
    const tenant = await this.pool.query<{ id: string }>(
      'select id from platform.tenants where clerk_org_id = $1',
      [input.externalOrganizationId],
    );
    const user = await this.pool.query<{ id: string }>(
      'select id from platform.users where clerk_user_id = $1',
      [input.externalUserId],
    );

    const tenantId = tenant.rows[0]?.id;
    const userId = user.rows[0]?.id;
    if (tenantId === undefined || userId === undefined) {
      // Webhook fora de ordem. O provisionamento sob demanda resolve no primeiro acesso.
      return undefined;
    }

    const membershipId = await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const previous = await tx.client.query<{ status: string; clerk_membership_id: string }>(
          'select status, clerk_membership_id from platform.memberships where user_id = $1',
          [userId],
        );
        const before = previous.rows[0];

        const result = await tx.client.query<{ id: string }>(
          // Conflito pela dupla (tenant, usuário), e não pelo id do Clerk: assim o vínculo
          // criado sob demanda é reconciliado quando o webhook chega com o id verdadeiro.
          `insert into platform.memberships (id, tenant_id, user_id, clerk_membership_id, status)
           values ($1, $2, $3, $4, 'ACTIVE')
           on conflict (tenant_id, user_id) do update
             set clerk_membership_id = excluded.clerk_membership_id,
                 status = 'ACTIVE',
                 updated_at = now()
           returning id`,
          [newId(), tenantId, userId, input.externalId],
        );

        const id = result.rows[0]?.id;
        if (id === undefined) {
          return '';
        }

        const after = { status: 'ACTIVE', clerkMembershipId: input.externalId };
        if (before === undefined) {
          await this.audit.record(tx, {
            module: 'platform',
            entity: 'membership',
            entityId: id,
            action: 'CREATE',
            after,
          });
        } else if (before.status !== 'ACTIVE' || before.clerk_membership_id !== input.externalId) {
          // Reativação, ou reconciliação do id provisório do provisionamento sob demanda.
          await this.audit.record(tx, {
            module: 'platform',
            entity: 'membership',
            entityId: id,
            action: 'UPDATE',
            before: { status: before.status, clerkMembershipId: before.clerk_membership_id },
            after,
          });
        }

        return id;
      }),
    );

    if (membershipId.length === 0) {
      return undefined;
    }

    await this.assignInitialRole(tenantId, membershipId, input.clerkRole);
    return membershipId;
  }

  /**
   * Provisionamento sob demanda a partir do próprio token (ADR-004).
   *
   * O token com `o.id` já é prova de que o Clerk considera o usuário membro daquela
   * organização: não é preciso consultar a Backend API para saber disso. O id do vínculo
   * é provisório até o webhook chegar com o verdadeiro.
   */
  provisionMembershipFromSession(input: {
    externalOrganizationId: string;
    externalUserId: string;
    clerkRole: string;
  }): Promise<EntityId | undefined> {
    return this.upsertMembership({
      externalId: `jit_${input.externalOrganizationId}_${input.externalUserId}`,
      externalOrganizationId: input.externalOrganizationId,
      externalUserId: input.externalUserId,
      clerkRole: input.clerkRole,
    });
  }

  async revokeMembership(externalMembershipId: string): Promise<void> {
    const found = await this.platformPool.query<{ tenant_id: string }>(
      'select tenant_id from platform.memberships where clerk_membership_id = $1',
      [externalMembershipId],
    );
    const tenantId = found.rows[0]?.tenant_id;
    if (tenantId === undefined) {
      return;
    }

    await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const updated = await tx.client.query<{ id: string }>(
          `update platform.memberships set status = 'REVOKED', updated_at = now()
            where clerk_membership_id = $1
            returning id`,
          [externalMembershipId],
        );
        const membershipId = updated.rows[0]?.id;
        if (membershipId !== undefined) {
          await this.audit.record(tx, {
            module: 'platform',
            entity: 'membership',
            entityId: membershipId,
            action: 'UPDATE',
            before: { status: 'ACTIVE' },
            after: { status: 'REVOKED' },
          });
        }
      }),
    );
  }

  private async revokeMembershipsOfUser(tenantId: EntityId, userId: EntityId): Promise<void> {
    await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx(async (tx) => {
        const updated = await tx.client.query<{ id: string }>(
          `update platform.memberships set status = 'REVOKED', updated_at = now()
            where user_id = $1 and status = 'ACTIVE'
            returning id`,
          [userId],
        );
        for (const row of updated.rows) {
          await this.audit.record(tx, {
            module: 'platform',
            entity: 'membership',
            entityId: row.id,
            action: 'UPDATE',
            before: { status: 'ACTIVE' },
            after: { status: 'REVOKED', reason: 'usuário excluído no provedor' },
          });
        }
      }),
    );
  }

  /** `org:admin` no Clerk vira `Administrador`; o resto, `Membro de Equipe` (ADR-004). */
  private async assignInitialRole(
    tenantId: EntityId,
    membershipId: EntityId,
    clerkRole: string,
  ): Promise<void> {
    const current = await this.roles.listMembershipRoles(tenantId, membershipId);
    if (current.length > 0) {
      // Depois do primeiro acesso, só o RBAC local vale: não sobrescrevemos o que o tenant fez.
      return;
    }

    const roleName = clerkRole === CLERK_ADMIN_ROLE ? ADMINISTRATOR_ROLE : DEFAULT_MEMBER_ROLE;
    const roleId = await this.roles.findSystemRoleByName(tenantId, roleName);
    if (roleId !== undefined) {
      await this.roles.assignRoles(tenantId, membershipId, { roleIds: [roleId] });
    }
  }

  /**
   * Auditoria de uma mudança feita pela sincronização, e não por uma pessoa: o `userId`
   * fica ausente de propósito — quem agiu foi o provedor de identidade.
   */
  private async auditSystemAction(
    tenantId: EntityId,
    entity: string,
    entityId: EntityId,
    action: 'CREATE' | 'UPDATE',
    after: Record<string, unknown>,
    before?: Record<string, unknown>,
  ): Promise<void> {
    await runInTenantContext({ tenantId }, () =>
      this.tenantDb.withTenantTx((tx: TenantTransaction) =>
        this.audit.record(tx, {
          module: 'platform',
          entity,
          entityId,
          action,
          after,
          ...(before === undefined ? {} : { before }),
        }),
      ),
    );
  }
}

function primaryEmailOf(data: Readonly<Record<string, unknown>>): string {
  const addresses = (data['email_addresses'] ?? data['emailAddresses']) as
    readonly Record<string, unknown>[] | undefined;
  const primaryId = data['primary_email_address_id'] ?? data['primaryEmailAddressId'];
  const primary = addresses?.find((address) => address['id'] === primaryId) ?? addresses?.[0];
  return String(primary?.['email_address'] ?? primary?.['emailAddress'] ?? '');
}

function nameOf(data: Readonly<Record<string, unknown>>): string {
  const first = String(data['first_name'] ?? data['firstName'] ?? '').trim();
  const last = String(data['last_name'] ?? data['lastName'] ?? '').trim();
  const full = [first, last].filter((part) => part.length > 0).join(' ');
  return full.length > 0 ? full : primaryEmailOf(data) || String(data['id']);
}
