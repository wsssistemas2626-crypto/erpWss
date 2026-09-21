import { verifyToken } from '@clerk/backend';
import type { SessionClaims } from '../identity-provider';
import { AuthInvalidTokenError } from '../errors';

export interface SessionTokenVerifierOptions {
  /** Chave pública do provedor, em PEM ou JWK. Torna a verificação networkless (ADR-004). */
  readonly jwtKey: string;
  /** Origens aceitas no claim `azp`. */
  readonly authorizedParties: readonly string[];
}

/** Formato do claim `o` do session token v2 do Clerk. */
interface OrganizationClaim {
  readonly id?: unknown;
  readonly slg?: unknown;
  readonly rol?: unknown;
}

/**
 * Verificação do session token sem ida à rede: assinatura, `exp`, `nbf` e `azp` são
 * checados contra a chave pública configurada. É o mesmo caminho em produção e no teste —
 * no teste, com uma chave gerada localmente (ver `FakeIdentityProvider`).
 */
export async function verifySessionToken(
  token: string,
  options: SessionTokenVerifierOptions,
): Promise<SessionClaims> {
  let claims: Awaited<ReturnType<typeof verifyToken>>;
  try {
    claims = await verifyToken(token, {
      jwtKey: options.jwtKey,
      authorizedParties: [...options.authorizedParties],
    });
  } catch (error) {
    throw new AuthInvalidTokenError(reasonOf(error));
  }

  const organization = readOrganization(claims);

  return {
    externalUserId: String(claims.sub),
    sessionId: String(claims.sid ?? ''),
    ...(organization.id === undefined ? {} : { externalOrganizationId: organization.id }),
    ...(organization.slug === undefined ? {} : { organizationSlug: organization.slug }),
    ...(organization.role === undefined ? {} : { organizationRole: organization.role }),
  };
}

function readOrganization(claims: Record<string, unknown>): {
  id?: string;
  slug?: string;
  role?: string;
} {
  const organization = claims['o'] as OrganizationClaim | undefined;
  if (organization === undefined || typeof organization.id !== 'string') {
    return {};
  }
  return {
    id: organization.id,
    ...(typeof organization.slg === 'string' ? { slug: organization.slg } : {}),
    ...(typeof organization.rol === 'string' ? { role: organization.rol } : {}),
  };
}

/** A mensagem do erro do Clerk é útil no log; nunca vai para a resposta. */
function reasonOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'reason' in error) {
    const reason = (error as { reason?: { message?: unknown } }).reason;
    if (reason?.message !== undefined) {
      return String(reason.message);
    }
  }
  return error instanceof Error ? error.message : String(error);
}
