import { createClerkClient, type ClerkClient } from '@clerk/backend';
import type {
  IdentityOrganization,
  IdentityProvider,
  IdentityUser,
  SessionClaims,
} from '../identity-provider';
import { verifySessionToken, type SessionTokenVerifierOptions } from './verify-session-token';

export interface ClerkIdentityProviderOptions extends SessionTokenVerifierOptions {
  /** Usada só para buscar usuário e organização (provisionamento sob demanda, F0-11). */
  readonly secretKey: string;
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
    const user = await this.client.users.getUser(externalUserId);
    const email =
      user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

    return {
      externalId: user.id,
      email: email ?? '',
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || (email ?? user.id),
    };
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
