import { DomainError } from '@erp/shared-kernel';
import { WEBHOOK_SIGNATURE_INVALID } from './webhooks/webhook-errors';

/**
 * Erros de autenticação e de acesso ao tenant (F0-07).
 * Os `code` são estáveis: é por eles que o front decide o que mostrar.
 */
export const AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN';
export const AUTH_USER_NOT_PROVISIONED = 'AUTH_USER_NOT_PROVISIONED';
export const TENANT_NOT_SELECTED = 'TENANT_NOT_SELECTED';
export const TENANT_NOT_PROVISIONED = 'TENANT_NOT_PROVISIONED';
export const TENANT_ACCESS_REVOKED = 'TENANT_ACCESS_REVOKED';
export const TENANT_INACTIVE = 'TENANT_INACTIVE';
export const AUTH_FORBIDDEN = 'AUTH_FORBIDDEN';

export class AuthInvalidTokenError extends DomainError {
  constructor(reason?: string) {
    super(AUTH_INVALID_TOKEN, 'Token de sessão ausente ou inválido.', reason ? { reason } : {});
    this.name = 'AuthInvalidTokenError';
  }
}

export class UserNotProvisionedError extends DomainError {
  constructor(externalUserId: string) {
    super(AUTH_USER_NOT_PROVISIONED, 'Usuário ainda não provisionado neste sistema.', {
      externalUserId,
    });
    this.name = 'UserNotProvisionedError';
  }
}

export class TenantNotSelectedError extends DomainError {
  constructor() {
    super(TENANT_NOT_SELECTED, 'Nenhuma organização ativa na sessão.');
    this.name = 'TenantNotSelectedError';
  }
}

export class TenantNotProvisionedError extends DomainError {
  constructor(externalOrganizationId: string) {
    super(TENANT_NOT_PROVISIONED, 'Organização ainda não provisionada neste sistema.', {
      externalOrganizationId,
    });
    this.name = 'TenantNotProvisionedError';
  }
}

export class TenantAccessRevokedError extends DomainError {
  constructor() {
    super(TENANT_ACCESS_REVOKED, 'Seu acesso a esta organização foi revogado.');
    this.name = 'TenantAccessRevokedError';
  }
}

export class TenantInactiveError extends DomainError {
  constructor(status: string) {
    super(TENANT_INACTIVE, 'Esta organização não está ativa.', { status });
    this.name = 'TenantInactiveError';
  }
}

export class AuthForbiddenError extends DomainError {
  constructor(permission: string) {
    super(AUTH_FORBIDDEN, 'Você não tem permissão para esta ação.', { permission });
    this.name = 'AuthForbiddenError';
  }
}

/** Status HTTP dos códigos desta lib, entregue ao `ProblemDetailsFilter` na composição. */
export const IAM_ERROR_STATUS: Readonly<Record<string, number>> = {
  [AUTH_INVALID_TOKEN]: 401,
  [AUTH_USER_NOT_PROVISIONED]: 403,
  [TENANT_NOT_SELECTED]: 403,
  [TENANT_NOT_PROVISIONED]: 403,
  [TENANT_ACCESS_REVOKED]: 403,
  [TENANT_INACTIVE]: 403,
  [AUTH_FORBIDDEN]: 403,
  [WEBHOOK_SIGNATURE_INVALID]: 400,
};
