/**
 * Superfície pública de @erp/web-shell.
 *
 * Providers, autenticação e troca de organização (F0-12); layout com menu por permissão,
 * i18n pt-BR, formatação brasileira e os componentes base de UI (F0-13).
 */
export { ptBRTranslations, type AppTranslations } from './i18n/pt-BR';
export { APP_LOCALE, DEFAULT_NAMESPACE, createI18n } from './i18n/i18n';
export { I18nProvider, type I18nProviderProps } from './i18n/i18n-provider';

export {
  APP_TIME_ZONE,
  DEFAULT_CURRENCY,
  formatDate,
  formatDateTime,
  formatHours,
  formatMoney,
  formatPercentage,
  formatQuantity,
} from './format/format';

export {
  ApiClient,
  ApiError,
  type ApiClientOptions,
  type QueryParams,
  type RequestConfig,
  type TokenGetter,
} from './api/api-client';

export { API_BASE_URL, ApiProvider, useApi, type ApiProviderProps } from './api/api-provider';
export { ME_QUERY_KEY, useMe } from './api/use-me';

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

export {
  canSeeMenuItem,
  visibleMenuItems,
  type MenuAccess,
  type MenuItem,
  type MenuLabelKey,
} from './menu/menu';

export { AppShell, type AppShellProps } from './layout/app-shell';

export { cn } from './ui/cn';
export { Button, buttonVariants, type ButtonProps } from './ui/button';
export { Input, type InputProps } from './ui/input';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
export { ConfirmDialog, type ConfirmDialogProps } from './ui/confirm-dialog';
export { EmptyState, type EmptyStateProps } from './ui/empty-state';
export { DataTable, type DataTableProps } from './ui/data-table';
export {
  Form,
  FormActions,
  FormField,
  useZodForm,
  type FormActionsProps,
  type FormFieldProps,
  type FormProps,
} from './ui/form';
