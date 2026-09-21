/**
 * Fronteira com o provedor de identidade (ADR-004).
 *
 * Nenhuma outra lib do backend importa `@clerk/*`: trocar de provedor, ou testar sem
 * rede, é implementar esta interface. O que entra aqui é sempre "identidade externa";
 * o id local (uuid) é resolvido pelo repositório, não pelo provedor.
 */

/** Claims do session token v2 do Clerk, já traduzidos para o vocabulário do sistema. */
export interface SessionClaims {
  /** `sub`: id do usuário no provedor. */
  readonly externalUserId: string;
  /** `sid`: id da sessão. */
  readonly sessionId: string;
  /** `o.id`: organização ativa. Ausente quando o usuário não escolheu organização. */
  readonly externalOrganizationId?: string;
  /** `o.slg`: slug da organização ativa. */
  readonly organizationSlug?: string;
  /** `o.rol`: papel no provedor. Só decide o papel inicial no provisionamento (ADR-004). */
  readonly organizationRole?: string;
}

export interface IdentityUser {
  readonly externalId: string;
  readonly email: string;
  readonly name: string;
}

export interface IdentityOrganization {
  readonly externalId: string;
  readonly name: string;
  readonly slug: string;
}

export interface IdentityProvider {
  /** Verifica assinatura, `exp`, `nbf` e `azp`. Lança se o token não servir. */
  verifySessionToken(token: string): Promise<SessionClaims>;
  getUser(externalUserId: string): Promise<IdentityUser>;
  getOrganization(externalOrganizationId: string): Promise<IdentityOrganization>;
}

/** Token de injeção: o backend depende da interface, nunca da implementação. */
export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
