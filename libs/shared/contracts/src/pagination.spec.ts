import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginated,
  paginatedSchema,
  paginationQuerySchema,
  toOffsetLimit,
} from './pagination';

describe('F0-06 paginação', () => {
  it('usa página 1 e o tamanho padrão quando nada é enviado', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('converte os valores que chegam como string na query', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('recusa tamanho de página acima do máximo e página zero', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: MAX_PAGE_SIZE + 1 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: 1.5 }).success).toBe(false);
  });

  it('traduz página e tamanho em offset e limit', () => {
    expect(toOffsetLimit({ page: 1, pageSize: 20 })).toEqual({ offset: 0, limit: 20 });
    expect(toOffsetLimit({ page: 3, pageSize: 20 })).toEqual({ offset: 40, limit: 20 });
  });

  it('monta a resposta no formato { items, page, pageSize, total }', () => {
    const resposta = paginated(['a', 'b'], { page: 2, pageSize: 20 }, 42);

    expect(resposta).toEqual({ items: ['a', 'b'], page: 2, pageSize: 20, total: 42 });
    expect(paginatedSchema(z.string()).safeParse(resposta).success).toBe(true);
  });
});
