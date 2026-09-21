import { runInTenantContext } from '@erp/platform-tenancy';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runInAuthContext, type AuthContext } from '../auth-context';
import { AuthInvalidTokenError } from '../errors';
import { IDENTITY_PROVIDER, type IdentityProvider } from '../identity-provider';
import { IdentityRepository } from '../infra/identity-repository';
import { TenantNotProvisionedError, UserNotProvisionedError } from '../errors';

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

    const user = await this.repository.findUserByExternalId(claims.externalUserId);
    if (user === undefined) {
      // No F0-11 este ponto passa a provisionar sob demanda em vez de recusar.
      throw new UserNotProvisionedError(claims.externalUserId);
    }

    if (claims.externalOrganizationId === undefined) {
      return { user, sessionId: claims.sessionId };
    }

    const tenant = await this.repository.findTenantByExternalId(claims.externalOrganizationId);
    if (tenant === undefined) {
      throw new TenantNotProvisionedError(claims.externalOrganizationId);
    }

    const membership = await this.repository.findMembership(tenant.id, user.id);

    return {
      user,
      sessionId: claims.sessionId,
      tenant,
      ...(membership === undefined
        ? {}
        : { membershipId: membership.id, membershipStatus: membership.status }),
    };
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
