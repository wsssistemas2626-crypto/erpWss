import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getAuthContext } from '../auth-context';
import { AuthForbiddenError, AuthInvalidTokenError } from '../errors';
import { PermissionService } from '../rbac/permission-service';

import { IS_PUBLIC, REQUIRED_PERMISSION } from '@erp/platform-http';

/**
 * Autorização (ADR-004). Roda depois do `AuthGuard`, que já garantiu usuário, tenant
 * ativo e vínculo ativo — aqui só se pergunta se esse vínculo tem a permissão da rota.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) === true) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION, targets);
    if (required === undefined) {
      // Leitura sem permissão declarada continua valendo: basta estar autenticado no tenant.
      // Escrita sem declarar é barrada antes, pelo teste de arquitetura.
      return true;
    }

    const auth = getAuthContext();
    if (auth === undefined) {
      throw new AuthInvalidTokenError('requisição sem token');
    }
    if (auth.tenant === undefined || auth.membershipId === undefined) {
      throw new AuthForbiddenError(required);
    }

    const allowed = await this.permissions.has(auth.tenant.id, auth.membershipId, required);
    if (!allowed) {
      throw new AuthForbiddenError(required);
    }
    return true;
  }
}
