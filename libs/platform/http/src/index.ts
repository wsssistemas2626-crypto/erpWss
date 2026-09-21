/**
 * Superfície pública de @erp/platform-http.
 * As convenções que todo controller do sistema herda: validação com zod, erros em
 * problem+json (RFC 9457), correlação de requisição e OpenAPI.
 */
export { ZodValidationPipe, toFieldIssues, zodPipe } from './zod-validation.pipe';

export { CORRELATION_ID_HEADER, CorrelationIdMiddleware } from './correlation-id.middleware';

export { ProblemDetailsFilter, type ProblemDetailsFilterOptions } from './problem-details.filter';

export { OPENAPI_PATH, setupOpenApi, type OpenApiOptions } from './openapi';

export {
  ALLOWS_WITHOUT_TENANT,
  AllowWithoutTenant,
  IS_PUBLIC,
  Public,
  REQUIRED_PERMISSION,
  RequirePermission,
} from './authorization.decorators';
