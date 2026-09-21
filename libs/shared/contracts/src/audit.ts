import { z } from 'zod';
import { paginationQuerySchema } from './pagination';

export const auditActionSchema = z.enum(['CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE']);

/** `GET /api/v1/audit?entity=role&entityId=...` */
export const auditQuerySchema = paginationQuerySchema.extend({
  entity: z.string().trim().min(1).max(80),
  entityId: z.uuid(),
});

export const auditRecordSchema = z.object({
  id: z.uuid(),
  occurredAt: z.string(),
  userId: z.uuid().nullable(),
  correlationId: z.string().nullable(),
  module: z.string(),
  entity: z.string(),
  entityId: z.uuid(),
  action: auditActionSchema,
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
});

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
export type AuditRecordDto = z.infer<typeof auditRecordSchema>;
