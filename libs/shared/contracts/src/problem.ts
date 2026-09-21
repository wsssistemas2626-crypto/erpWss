import { z } from 'zod';

/**
 * Corpo de erro da API no formato RFC 9457 (`application/problem+json`).
 *
 * `code` é o campo estável em inglês pelo qual o front escolhe a mensagem em pt-BR;
 * `detail` é texto de apoio e pode mudar sem aviso.
 */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const fieldIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string(),
  correlationId: z.string().optional(),
  errors: z.array(fieldIssueSchema).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type FieldIssueDto = z.infer<typeof fieldIssueSchema>;
