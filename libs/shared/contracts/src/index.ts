/**
 * Superfície pública de @erp/shared-contracts.
 * Schemas zod e tipos de API compartilhados entre o back e o front: o mesmo schema
 * valida a entrada no servidor e tipa a chamada no cliente.
 */
export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginated,
  paginatedSchema,
  paginationQuerySchema,
  toOffsetLimit,
  type PaginatedResponse,
  type PaginationQuery,
} from './pagination';

export {
  PROBLEM_CONTENT_TYPE,
  fieldIssueSchema,
  problemDetailsSchema,
  type FieldIssueDto,
  type ProblemDetails,
} from './problem';

export { versionSchema, versionedSchema, withVersion } from './concurrency';
