import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { verifyWebhook } from '@clerk/backend/webhooks';
import type {
  IdentityMembership,
  IdentityOrganization,
  IdentityProvider,
  IdentityUser,
  SessionClaims,
} from '../identity-provider';
import { verifySessionToken, type SessionTokenVerifierOptions } from './verify-session-token';
import { WebhookSignatureInvalidError } from '../webhooks/webhook-errors';
import type { IdentityWebhookEvent, WebhookRequest } from '../webhooks/webhook-event';

export interface ClerkIdentityProviderOptions extends SessionTokenVerifierOptions {
  /** Usada só para buscar usuário e organização (provisionamento sob demanda, F0-11). */
  readonly secretKey: string;
  /** Segredo de assinatura dos webhooks (Svix). */
  readonly webhookSigningSecret: string;
}

/**
 * Implementação do `IdentityProvider` sobre o Clerk (ADR-004).
 * Única classe do backend que fala com `@clerk/backend`.
 */
export class ClerkIdentityProvider implements IdentityProvider {
  private readonly client: ClerkClient;

  constructor(private readonly options: ClerkIdentityProviderOptions) {
    this.client = createClerkClient({ secretKey: options.secretKey });
  }

  verifySessionToken(token: string): Promise<SessionClaims> {
    return verifySessionToken(token, this.options);
  }

  async getUser(externalUserId: string): Promise<IdentityUser> {
    return toIdentityUser(await this.client.users.getUser(externalUserId));
  }

  /** Só a semeadura de desenvolvimento usa: em produção o usuário chega pelo token. */
  async findUserByEmail(email: string): Promise<IdentityUser | undefined> {
    const found = await this.client.users.getUserList({ emailAddress: [email], limit: 2 });
    const user = found.data[0];
    return user === undefined ? undefined : toIdentityUser(user);
  }

  async listMembershipsOfUser(externalUserId: string): Promise<readonly IdentityMembership[]> {
    const memberships = await this.client.users.getOrganizationMembershipList({
      userId: externalUserId,
      limit: 100,
    });

    return memberships.data.map((membership) => ({
      externalId: membership.id,
      organization: {
        externalId: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug ?? membership.organization.id,
      },
      role: membership.role,
    }));
  }

  /**
   * O `verifyWebhook` do Clerk recebe um `Request` do Fetch API. Reconstruímos um a partir
   * do corpo bruto que o controller preservou — reserializar o JSON mudaria os bytes e a
   * assinatura deixaria de bater.
   */
  async verifyWebhook(request: WebhookRequest): Promise<IdentityWebhookEvent> {
    const fetchRequest = new Request('https://webhook.local/api/v1/webhooks/clerk', {
      method: 'POST',
      headers: new Headers(request.headers as Record<string, string>),
      body: request.payload,
    });

    try {
      const event = await verifyWebhook(fetchRequest, {
        signingSecret: this.options.webhookSigningSecret,
      });
      return { type: event.type, data: event.data as unknown as Record<string, unknown> };
    } catch (error) {
      throw new WebhookSignatureInvalidError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async getOrganization(externalOrganizationId: string): Promise<IdentityOrganization> {
    const organization = await this.client.organizations.getOrganization({
      organizationId: externalOrganizationId,
    });

    return {
      externalId: organization.id,
      name: organization.name,
      slug: organization.slug ?? organization.id,
    };
  }
}

interface ClerkUserLike {
  readonly id: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly primaryEmailAddressId: string | null;
  readonly emailAddresses: readonly { readonly id: string; readonly emailAddress: string }[];
}

function toIdentityUser(user: ClerkUserLike): IdentityUser {
  const email =
    user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
      ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

  return {
    externalId: user.id,
    email: email ?? '',
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || (email ?? user.id),
  };
}
