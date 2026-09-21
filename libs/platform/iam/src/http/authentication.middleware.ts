import { runInTenantContext } from '@erp/platform-tenancy';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  runInAuthContext,
  type AuthContext,
  type AuthenticatedTenant,
  type AuthenticatedUser,
} from '../auth-context';
import {
  AuthInvalidTokenError,
  TenantNotProvisionedError,
  UserNotProvisionedError,
} from '../errors';
import { IDENTITY_PROVIDER, type IdentityProvider } from '../identity-provider';
import { IdentityRepository } from '../infra/identity-repository';
import { IdentitySyncService } from '../webhooks/identity-sync-service';

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * Autenticação da requisição (ADR-004).
 *
 * É middleware, e não guard, porque precisa instalar o `AuthContext` e o `TenantContext`
 * (AsyncLocalStorage) ao redor de **todo** o restante da requisição — guard, interceptor
 * e handler. Um guard só devolve booleano: o escopo dele termina antes do handler.
 *
 * Aqui só se reúnem fatos. Quem decide se a requisição segue é o `AuthGuard`, que conhece
 * as exigências da rota.
 */
@Injectable()
export class AuthenticationMiddleware implements NestMiddleware {
  constructor(
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    private readonly repository: IdentityRepository,
    private readonly sync: IdentitySyncService,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const token = bearerToken(request);
    if (token === undefined) {
      // Sem token não há o que montar: rota pública segue, rota protegida morre no guard.
      next();
      return;
    }

    this.buildContext(token)
      .then((context) => {
        const tenantId = context.tenant?.id;
        runInAuthContext(context, () => {
          if (tenantId === undefined) {
            next();
            return;
          }
          runInTenantContext({ tenantId }, () => {
            next();
          });
        });
      })
      .catch((error: unknown) => {
        next(error);
      });
  }

  private async buildContext(token: string): Promise<AuthContext> {
    const claims = await this.identity.verifySessionToken(token);

    // Provisionamento sob demanda (ADR-004): se o webhook ainda não chegou — ou nunca vai
    // chegar, como em desenvolvimento sem túnel —, o primeiro acesso com token válido
    // materializa usuário, tenant e vínculo. O sistema funciona sem webhook.
    const user =
      (await this.repository.findUserByExternalId(claims.externalUserId)) ??
      (await this.provisionUser(claims.externalUserId));

    if (claims.externalOrganizationId === undefined) {
      return { user, sessionId: claims.sessionId };
    }

    const tenant =
      (await this.repository.findTenantByExternalId(claims.externalOrganizationId)) ??
      (await this.provisionTenant(claims.externalOrganizationId));

    let membership = await this.repository.findMembership(tenant.id, user.id);
    if (membership === undefined) {
      await this.sync.provisionMembershipFromSession({
        externalOrganizationId: claims.externalOrganizationId,
        externalUserId: claims.externalUserId,
        clerkRole: claims.organizationRole ?? '',
      });
      membership = await this.repository.findMembership(tenant.id, user.id);
    }

    return {
      user,
      sessionId: claims.sessionId,
      tenant,
      ...(membership === undefined
        ? {}
        : { membershipId: membership.id, membershipStatus: membership.status }),
    };
  }

  private async provisionUser(externalUserId: string): Promise<AuthenticatedUser> {
    // Se nem o provedor conhece o usuário, não há o que provisionar: é 403, não 500.
    const fromProvider = await this.identity.getUser(externalUserId).catch(() => {
      throw new UserNotProvisionedError(externalUserId);
    });
    await this.sync.upsertUser({
      externalId: fromProvider.externalId,
      email: fromProvider.email,
      name: fromProvider.name,
    });

    const user = await this.repository.findUserByExternalId(externalUserId);
    if (user === undefined) {
      throw new UserNotProvisionedError(externalUserId);
    }
    return user;
  }

  private async provisionTenant(externalOrganizationId: string): Promise<AuthenticatedTenant> {
    const fromProvider = await this.identity.getOrganization(externalOrganizationId).catch(() => {
      throw new TenantNotProvisionedError(externalOrganizationId);
    });
    await this.sync.upsertTenant({
      externalId: fromProvider.externalId,
      name: fromProvider.name,
      slug: fromProvider.slug,
    });

    const tenant = await this.repository.findTenantByExternalId(externalOrganizationId);
    if (tenant === undefined) {
      throw new TenantNotProvisionedError(externalOrganizationId);
    }
    return tenant;
  }
}

function bearerToken(request: Request): string | undefined {
  const header = request.header('authorization');
  if (header === undefined) {
    return undefined;
  }
  const match = BEARER.exec(header);
  return match?.[1]?.trim();
}

export { AuthInvalidTokenError };
