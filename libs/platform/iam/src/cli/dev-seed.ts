import type { EntityId } from '@erp/shared-kernel';
import type { IdentityProvider } from '../identity-provider';
import type { IdentitySyncService } from '../webhooks/identity-sync-service';

export interface SeededTenant {
  readonly id: EntityId;
  readonly externalId: string;
  readonly slug: string;
  /** Papel de organização no provedor, que decidiu o papel local inicial. */
  readonly role: string;
  readonly created: boolean;
}

export interface DevSeedResult {
  readonly userId: EntityId;
  readonly externalUserId: string;
  readonly tenants: readonly SeededTenant[];
}

export class DevSeedUserNotFoundError extends Error {
  constructor(email: string) {
    super(
      `Nenhum usuário com o e-mail ${email} na instância de desenvolvimento do provedor. ` +
        'Crie-o no painel e refaça o convite para a organização de teste.',
    );
    this.name = 'DevSeedUserNotFoundError';
  }
}

/**
 * Semeadura de desenvolvimento (`pnpm cli dev:seed`, F0-11).
 *
 * Em desenvolvimento e no E2E não há túnel para o webhook chegar, e o provisionamento sob
 * demanda só acontece quando alguém entra. Este comando faz o mesmo trabalho antes disso,
 * partindo do e-mail do usuário de teste: copia o usuário, as organizações dele e os
 * vínculos. É o mesmo caminho do webhook — upserts idempotentes —, então rodar duas vezes
 * não duplica nada nem sobrescreve papéis já ajustados no tenant.
 */
export async function seedDevelopmentIdentity(
  identity: IdentityProvider,
  sync: IdentitySyncService,
  email: string,
): Promise<DevSeedResult> {
  const user = await identity.findUserByEmail(email);
  if (user === undefined) {
    throw new DevSeedUserNotFoundError(email);
  }

  const userId = await sync.upsertUser(user);
  const memberships = await identity.listMembershipsOfUser(user.externalId);

  const tenants: SeededTenant[] = [];
  for (const membership of memberships) {
    const tenant = await sync.upsertTenant(membership.organization);
    await sync.upsertMembership({
      externalId: membership.externalId,
      externalOrganizationId: membership.organization.externalId,
      externalUserId: user.externalId,
      clerkRole: membership.role,
    });

    tenants.push({
      id: tenant.id,
      externalId: membership.organization.externalId,
      slug: membership.organization.slug,
      role: membership.role,
      created: tenant.created,
    });
  }

  return { userId, externalUserId: user.externalId, tenants };
}
