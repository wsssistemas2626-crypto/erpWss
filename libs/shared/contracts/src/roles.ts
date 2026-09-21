import { z } from 'zod';
import { withVersion } from './concurrency';

/** `<modulo>.<recurso>.<acao>` (CLAUDE.md §5). */
export const permissionKeySchema = z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/, {
  message: 'Permissão fora do formato <modulo>.<recurso>.<acao>.',
});

export const roleNameSchema = z.string().trim().min(2).max(80);

export const createRoleSchema = z.object({
  name: roleNameSchema,
  description: z.string().trim().max(400).optional(),
  permissions: z.array(permissionKeySchema).default([]),
});

export const updateRoleSchema = withVersion(
  z.object({
    name: roleNameSchema.optional(),
    description: z.string().trim().max(400).nullable().optional(),
    permissions: z.array(permissionKeySchema).optional(),
  }),
);

export const assignRolesSchema = z.object({
  roleIds: z.array(z.uuid()),
});

export const roleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  version: z.number().int().min(1),
  permissions: z.array(z.string()),
});

export const permissionDefinitionSchema = z.object({
  key: z.string(),
  description: z.string(),
});

export type CreateRole = z.infer<typeof createRoleSchema>;
export type UpdateRole = z.infer<typeof updateRoleSchema>;
export type AssignRoles = z.infer<typeof assignRolesSchema>;
export type Role = z.infer<typeof roleSchema>;
