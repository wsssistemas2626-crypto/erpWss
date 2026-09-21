import type { IdentityWebhookEvent, WebhookRequest } from './webhooks/webhook-event';

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

/** Vínculo de um usuário com uma organização, como o provedor o enxerga. */
export interface IdentityMembership {
  readonly externalId: string;
  readonly organization: IdentityOrganization;
  /** Papel de organização no provedor (`org:admin`, `org:member`). */
  readonly role: string;
}

export interface IdentityProvider {
  /** Verifica assinatura, `exp`, `nbf` e `azp`. Lança se o token não servir. */
  verifySessionToken(token: string): Promise<SessionClaims>;
  getUser(externalUserId: string): Promise<IdentityUser>;
  getOrganization(externalOrganizationId: string): Promise<IdentityOrganization>;
  /** Confere a assinatura do webhook sobre o corpo bruto. Lança se não bater. */
  verifyWebhook(request: WebhookRequest): Promise<IdentityWebhookEvent>;
  /**
   * Usados só pela semeadura de desenvolvimento (`pnpm cli dev:seed`), que parte do e-mail
   * do usuário de teste — não há token nem webhook de onde tirar os ids.
   */
  findUserByEmail(email: string): Promise<IdentityUser | undefined>;
  listMembershipsOfUser(externalUserId: string): Promise<readonly IdentityMembership[]>;
}

/** Token de injeção: o backend depende da interface, nunca da implementação. */
export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
