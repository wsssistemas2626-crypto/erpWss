/**
 * Superfície pública de @erp/platform-iam.
 *
 * Única lib do backend que importa `@clerk/*` (ADR-004). Tudo mais depende da interface
 * `IdentityProvider`. O provedor de testes fica em `@erp/platform-iam/testing`.
 */
export {
  IDENTITY_PROVIDER,
  type IdentityMembership,
  type IdentityOrganization,
  type IdentityProvider,
  type IdentityUser,
  type SessionClaims,
} from './identity-provider';

export {
  DevSeedUserNotFoundError,
  seedDevelopmentIdentity,
  type DevSeedResult,
  type SeededTenant,
} from './cli/dev-seed';

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
  AUTH_FORBIDDEN,
  AUTH_INVALID_TOKEN,
  AUTH_USER_NOT_PROVISIONED,
  AuthForbiddenError,
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
export { ClerkWebhookController, type WebhookAck } from './webhooks/webhook.controller';
export { DB_POOL_FOR_WEBHOOKS } from './webhooks/tokens';
export {
  CLERK_ADMIN_ROLE,
  DEFAULT_MEMBER_ROLE,
  IdentitySyncService,
  type SyncOutcome,
  type SyncedTenant,
} from './webhooks/identity-sync-service';
export {
  HANDLED_WEBHOOK_TYPES,
  SVIX_ID_HEADER,
  SVIX_SIGNATURE_HEADER,
  SVIX_TIMESTAMP_HEADER,
  type IdentityWebhookEvent,
  type IdentityWebhookType,
  type WebhookRequest,
} from './webhooks/webhook-event';
export { WEBHOOK_SIGNATURE_INVALID, WebhookSignatureInvalidError } from './webhooks/webhook-errors';
export { PermissionGuard } from './http/permission.guard';
export { RolesController } from './http/roles.controller';

export {
  PERMISSION_CATALOG,
  PERMISSION_KEY,
  PermissionCatalog,
  type PermissionDefinition,
} from './rbac/permission-catalog';
export { PermissionRepository, type RoleRecord } from './rbac/permission-repository';
export { PERMISSION_CACHE_TTL_MS, PermissionService } from './rbac/permission-service';
export { PLATFORM_MODULE, PLATFORM_PERMISSIONS } from './rbac/platform-permissions';
export { PERMISSION_UNKNOWN, ROLE_IS_SYSTEM, RoleService } from './rbac/role-service';
export { ADMINISTRATOR_ROLE, SYSTEM_ROLES, type SystemRoleDefinition } from './rbac/system-roles';
export { AuthenticationMiddleware } from './http/authentication.middleware';
export { MeController, type MeResponse } from './http/me.controller';
