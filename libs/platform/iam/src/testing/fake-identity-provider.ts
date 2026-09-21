import { createSign, generateKeyPairSync } from 'node:crypto';
import type {
  IdentityOrganization,
  IdentityProvider,
  IdentityUser,
  SessionClaims,
} from '../identity-provider';
import { verifySessionToken } from '../clerk/verify-session-token';

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

export class FakeIdentityProvider implements IdentityProvider {
  readonly publicKey: string;
  private readonly privateKey: string;
  private readonly users = new Map<string, IdentityUser>();
  private readonly organizations = new Map<string, IdentityOrganization>();

  constructor(readonly authorizedParties: readonly string[] = [FAKE_AUTHORIZED_PARTY]) {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    this.privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  }

  /** Registra o que `getUser` vai devolver (usado pelo provisionamento sob demanda). */
  addUser(user: IdentityUser): void {
    this.users.set(user.externalId, user);
  }

  addOrganization(organization: IdentityOrganization): void {
    this.organizations.set(organization.externalId, organization);
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
