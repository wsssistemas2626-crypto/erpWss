import { createHmac, createSign, generateKeyPairSync, timingSafeEqual } from 'node:crypto';
import type {
  IdentityMembership,
  IdentityOrganization,
  IdentityProvider,
  IdentityUser,
  SessionClaims,
} from '../identity-provider';
import { verifySessionToken } from '../clerk/verify-session-token';
import { WebhookSignatureInvalidError } from '../webhooks/webhook-errors';
import {
  SVIX_ID_HEADER,
  SVIX_SIGNATURE_HEADER,
  SVIX_TIMESTAMP_HEADER,
  type IdentityWebhookEvent,
  type WebhookRequest,
} from '../webhooks/webhook-event';

/**
 * Provedor de identidade para testes (ADR-004: nenhum teste do `pnpm check` acessa a rede).
 *
 * Gera um par de chaves RSA no processo e assina tokens no formato v2 do Clerk. A
 * verificação **não** é simulada: é a mesma `verifySessionToken` de produção, apontada
 * para a chave pública local. Ou seja, expiração, `nbf`, `azp` e assinatura são testados
 * no código que roda em produção, sem tocar na rede.
 */

export interface FakeTokenOptions {
  readonly externalUserId: string;
  readonly sessionId?: string;
  readonly externalOrganizationId?: string;
  readonly organizationSlug?: string;
  readonly organizationRole?: string;
  readonly azp?: string;
  /** Segundos a partir de agora. Negativo produz token expirado. */
  readonly expiresInSeconds?: number;
  /** Segundos a partir de agora. Positivo produz token ainda não válido. */
  readonly notBeforeInSeconds?: number;
}

export const FAKE_AUTHORIZED_PARTY = 'http://localhost:5173';

/** Segredo de teste no formato do Svix (`whsec_` + base64). */
export const FAKE_WEBHOOK_SECRET = 'whsec_dGVzdGUtZGUtc2VncmVkby1kby13ZWJob29r';

export class FakeIdentityProvider implements IdentityProvider {
  readonly publicKey: string;
  private readonly privateKey: string;
  private readonly users = new Map<string, IdentityUser>();
  private readonly organizations = new Map<string, IdentityOrganization>();
  /** Vínculos por usuário externo, como `listMembershipsOfUser` os devolve. */
  private readonly memberships = new Map<string, IdentityMembership[]>();

  constructor(readonly authorizedParties: readonly string[] = [FAKE_AUTHORIZED_PARTY]) {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    this.privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  }

  /**
   * Monta os headers Svix de um webhook assinado com o segredo de teste.
   * O mesmo esquema da produção — HMAC-SHA256 sobre `id.timestamp.payload` —, o que faz o
   * teste de assinatura inválida provar alguma coisa.
   */
  signWebhook(
    payload: string,
    options: { svixId?: string; timestamp?: number } = {},
  ): Record<string, string> {
    const svixId = options.svixId ?? `msg_${Math.random().toString(36).slice(2)}`;
    const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
    return {
      [SVIX_ID_HEADER]: svixId,
      [SVIX_TIMESTAMP_HEADER]: timestamp,
      [SVIX_SIGNATURE_HEADER]: `v1,${signature(svixId, timestamp, payload)}`,
    };
  }

  verifyWebhook(request: WebhookRequest): Promise<IdentityWebhookEvent> {
    const svixId = request.headers[SVIX_ID_HEADER];
    const timestamp = request.headers[SVIX_TIMESTAMP_HEADER];
    const header = request.headers[SVIX_SIGNATURE_HEADER];

    if (svixId === undefined || timestamp === undefined || header === undefined) {
      return Promise.reject(new WebhookSignatureInvalidError('headers svix ausentes'));
    }

    const expected = signature(svixId, timestamp, request.payload);
    const received = header
      .split(' ')
      .map((part) => part.split(',')[1] ?? '')
      .filter((value) => value.length > 0);

    if (!received.some((value) => safeEquals(value, expected))) {
      return Promise.reject(new WebhookSignatureInvalidError('assinatura não confere'));
    }

    const event = JSON.parse(request.payload) as IdentityWebhookEvent;
    return Promise.resolve(event);
  }

  /** Registra o que `getUser` vai devolver (usado pelo provisionamento sob demanda). */
  addUser(user: IdentityUser): void {
    this.users.set(user.externalId, user);
  }

  addOrganization(organization: IdentityOrganization): void {
    this.organizations.set(organization.externalId, organization);
  }

  /** Registra um vínculo, como o provedor o devolveria (usado pela semeadura). */
  addMembership(externalUserId: string, membership: IdentityMembership): void {
    this.organizations.set(membership.organization.externalId, membership.organization);
    const current = this.memberships.get(externalUserId) ?? [];
    this.memberships.set(externalUserId, [
      ...current.filter((existing) => existing.externalId !== membership.externalId),
      membership,
    ]);
  }

  /** Emite um token assinado com a chave local, no formato v2 do Clerk. */
  createSessionToken(options: FakeTokenOptions): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, unknown> = {
      azp: options.azp ?? this.authorizedParties[0] ?? FAKE_AUTHORIZED_PARTY,
      exp: now + (options.expiresInSeconds ?? 300),
      iat: now,
      iss: 'https://fake.clerk.local',
      nbf: now + (options.notBeforeInSeconds ?? -5),
      sid: options.sessionId ?? `sess_${options.externalUserId}`,
      sub: options.externalUserId,
      v: 2,
    };

    if (options.externalOrganizationId !== undefined) {
      payload['o'] = {
        id: options.externalOrganizationId,
        slg: options.organizationSlug ?? 'acme',
        rol: options.organizationRole ?? 'admin',
        per: '',
        fpm: '',
      };
    }

    return this.sign(payload);
  }

  /** Token assinado com outra chave: serve para provar que a assinatura é conferida. */
  createTokenSignedByStranger(options: FakeTokenOptions): string {
    return new FakeIdentityProvider(this.authorizedParties).createSessionToken(options);
  }

  verifySessionToken(token: string): Promise<SessionClaims> {
    return verifySessionToken(token, {
      jwtKey: this.publicKey,
      authorizedParties: this.authorizedParties,
    });
  }

  getUser(externalUserId: string): Promise<IdentityUser> {
    const user = this.users.get(externalUserId);
    if (user === undefined) {
      return Promise.reject(new Error(`Usuário ${externalUserId} não registrado no fake.`));
    }
    return Promise.resolve(user);
  }

  findUserByEmail(email: string): Promise<IdentityUser | undefined> {
    const found = [...this.users.values()].find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
    return Promise.resolve(found);
  }

  listMembershipsOfUser(externalUserId: string): Promise<readonly IdentityMembership[]> {
    return Promise.resolve(this.memberships.get(externalUserId) ?? []);
  }

  getOrganization(externalOrganizationId: string): Promise<IdentityOrganization> {
    const organization = this.organizations.get(externalOrganizationId);
    if (organization === undefined) {
      return Promise.reject(
        new Error(`Organização ${externalOrganizationId} não registrada no fake.`),
      );
    }
    return Promise.resolve(organization);
  }

  private sign(payload: Record<string, unknown>): string {
    const header = { alg: 'RS256', typ: 'JWT', kid: 'fake-key' };
    const data = `${encode(header)}.${encode(payload)}`;
    const signer = createSign('RSA-SHA256');
    signer.update(data);
    return `${data}.${signer.sign(this.privateKey).toString('base64url')}`;
  }
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(svixId: string, timestamp: string, payload: string): string {
  const secret = Buffer.from(FAKE_WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64');
  return createHmac('sha256', secret).update(`${svixId}.${timestamp}.${payload}`).digest('base64');
}

function safeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
