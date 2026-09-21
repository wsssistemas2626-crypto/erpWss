/**
 * Eventos do provedor de identidade que o sistema espelha localmente (ADR-004).
 *
 * O tipo é deliberadamente magro: só o que o sincronizador usa. Assim uma mudança no
 * payload do Clerk que não toque nestes campos não quebra nada aqui.
 */
export type IdentityWebhookType =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'organizationMembership.created'
  | 'organizationMembership.updated'
  | 'organizationMembership.deleted';

export const HANDLED_WEBHOOK_TYPES: readonly IdentityWebhookType[] = [
  'user.created',
  'user.updated',
  'user.deleted',
  'organization.created',
  'organization.updated',
  'organization.deleted',
  'organizationMembership.created',
  'organizationMembership.updated',
  'organizationMembership.deleted',
];

export interface IdentityWebhookEvent {
  readonly type: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface WebhookRequest {
  /** Corpo **bruto**: a assinatura é calculada sobre os bytes recebidos, não sobre o JSON reserializado. */
  readonly payload: string;
  readonly headers: Readonly<Record<string, string>>;
}

export const SVIX_ID_HEADER = 'svix-id';
export const SVIX_TIMESTAMP_HEADER = 'svix-timestamp';
export const SVIX_SIGNATURE_HEADER = 'svix-signature';
