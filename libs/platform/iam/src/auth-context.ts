import { AsyncLocalStorage } from 'node:async_hooks';
import type { EntityId } from '@erp/shared-kernel';
import { AuthInvalidTokenError } from './errors';

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
export type MembershipStatus = 'ACTIVE' | 'REVOKED';

export interface AuthenticatedUser {
  readonly id: EntityId;
  readonly externalId: string;
  readonly email: string;
  readonly name: string;
}

export interface AuthenticatedTenant {
  readonly id: EntityId;
  readonly externalId: string;
  readonly name: string;
  readonly slug: string;
  readonly status: TenantStatus;
}

/**
 * Quem está fazendo a requisição.
 *
 * O middleware de autenticação só reúne os fatos — inclusive os desfavoráveis, como um
 * membership revogado. Quem decide o que fazer com eles é o guard, porque só ele conhece
 * as exigências da rota (`GET /me` responde sem tenant; rota de negócio, não).
 */
export interface AuthContext {
  readonly user: AuthenticatedUser;
  readonly sessionId: string;
  readonly tenant?: AuthenticatedTenant;
  readonly membershipId?: EntityId;
  readonly membershipStatus?: MembershipStatus;
}

const storage = new AsyncLocalStorage<AuthContext>();

export function runInAuthContext<T>(context: AuthContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getAuthContext(): AuthContext | undefined {
  return storage.getStore();
}

export function requireAuthContext(): AuthContext {
  const context = storage.getStore();
  if (context === undefined) {
    throw new AuthInvalidTokenError('nenhuma autenticação no contexto');
  }
  return context;
}
