/**
 * Superfície pública de @erp/web-shell.
 * Autenticação e troca de organização (item F0-12); layout, menu por permissão,
 * i18n e formatação chegam no item F0-13.
 */
export { messages } from './messages';

export {
  ApiClient,
  ApiError,
  type ApiClientOptions,
  type QueryParams,
  type RequestConfig,
  type TokenGetter,
} from './api/api-client';

export {
  AppProviders,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  createQueryClient,
  type AppProvidersProps,
} from './auth/app-providers';

export {
  OrganizationCacheReset,
  useClearCacheOnOrganizationChange,
} from './auth/organization-cache';

export { RequireAuth, SessionLoading, type RequireAuthProps } from './auth/require-auth';

export { RequireOrganization, type RequireOrganizationProps } from './auth/require-organization';

export { ForbiddenPage, NotFoundPage, UnauthenticatedPage } from './pages/error-pages';
