import { z } from 'zod';

/** Paginação padrão da API (CLAUDE.md §5): `?page=1&pageSize=20`, máximo 100. */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/** Envelope de resposta paginada para um schema de item qualquer. */
export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE),
    total: z.number().int().min(0),
  });
}

export function paginated<T>(
  items: readonly T[],
  query: PaginationQuery,
  total: number,
): PaginatedResponse<T> {
  return { items, page: query.page, pageSize: query.pageSize, total };
}

/** Deslocamento e limite correspondentes, para o repositório. */
export function toOffsetLimit(query: PaginationQuery): { offset: number; limit: number } {
  return { offset: (query.page - 1) * query.pageSize, limit: query.pageSize };
}
