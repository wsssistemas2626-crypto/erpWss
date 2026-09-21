/**
 * Superfície pública de @erp/platform-iam.
 *
 * Única lib do backend que importa `@clerk/*` (ADR-004). Tudo mais depende da interface
 * `IdentityProvider`. O provedor de testes fica em `@erp/platform-iam/testing`.
 */
export {
  IDENTITY_PROVIDER,
  type IdentityOrganization,
  type IdentityProvider,
  type IdentityUser,
  type SessionClaims,
} from './identity-provider';

export {
  ClerkIdentityProvider,
  type ClerkIdentityProviderOptions,
} from './clerk/clerk-identity-provider';

export {
  getAuthContext,
  requireAuthContext,
  runInAuthContext,
  type AuthContext,
  type AuthenticatedTenant,
  type AuthenticatedUser,
  type MembershipStatus,
  type TenantStatus,
} from './auth-context';

export {
  AUTH_INVALID_TOKEN,
  AUTH_USER_NOT_PROVISIONED,
  AuthInvalidTokenError,
  IAM_ERROR_STATUS,
  TENANT_ACCESS_REVOKED,
  TENANT_INACTIVE,
  TENANT_NOT_PROVISIONED,
  TENANT_NOT_SELECTED,
  TenantAccessRevokedError,
  TenantInactiveError,
  TenantNotProvisionedError,
  TenantNotSelectedError,
  UserNotProvisionedError,
} from './errors';

export { IdentityRepository, type MembershipRecord } from './infra/identity-repository';
export { memberships, membershipStatus, users, userStatus } from './infra/schema';

export { AuthGuard } from './http/auth.guard';
export { AuthenticationMiddleware } from './http/authentication.middleware';
export { MeController, type MeResponse } from './http/me.controller';
export {
  ALLOWS_WITHOUT_TENANT,
  AllowWithoutTenant,
  IS_PUBLIC,
  Public,
} from './http/public.decorator';
