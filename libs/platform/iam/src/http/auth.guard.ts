import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getAuthContext } from '../auth-context';
import {
  AuthInvalidTokenError,
  TenantAccessRevokedError,
  TenantInactiveError,
  TenantNotSelectedError,
} from '../errors';
import { ALLOWS_WITHOUT_TENANT, IS_PUBLIC } from './public.decorator';

/**
 * Guard global de autenticação (ADR-004): **nega por padrão**.
 *
 * O middleware já reuniu os fatos; aqui se aplica a política, na ordem em que o usuário
 * precisa entender o problema: não autenticado → não escolheu organização → organização
 * inativa → acesso revogado.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) === true) {
      return true;
    }

    const auth = getAuthContext();
    if (auth === undefined) {
      throw new AuthInvalidTokenError('requisição sem token');
    }

    if (this.reflector.getAllAndOverride<boolean>(ALLOWS_WITHOUT_TENANT, targets) === true) {
      return true;
    }

    if (auth.tenant === undefined) {
      throw new TenantNotSelectedError();
    }

    if (auth.tenant.status !== 'ACTIVE') {
      throw new TenantInactiveError(auth.tenant.status);
    }

    if (auth.membershipStatus !== 'ACTIVE') {
      throw new TenantAccessRevokedError();
    }

    return true;
  }
}
