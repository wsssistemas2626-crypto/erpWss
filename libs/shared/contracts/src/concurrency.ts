import { z } from 'zod';

/**
 * Controle de concorrência otimista (CLAUDE.md §5): todo PUT/PATCH de entidade
 * editável carrega a `version` que o cliente tinha em mãos.
 */
export const versionSchema = z.number().int().min(1);

export const versionedSchema = z.object({ version: versionSchema });

/** Acrescenta `version` obrigatória a um schema de atualização. */
export function withVersion<Shape extends z.ZodRawShape>(schema: z.ZodObject<Shape>) {
  return schema.extend({ version: versionSchema });
}
