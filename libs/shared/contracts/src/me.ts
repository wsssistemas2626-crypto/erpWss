import { z } from 'zod';
import { permissionKeySchema } from './roles';

/**
 * `GET /api/v1/me`: quem sou eu, em qual organização estou, o que posso fazer e
 * quais módulos esta organização tem habilitados.
 *
 * É a única resposta autenticada que aceita `tenant: null` — é por ela que o front
 * descobre que precisa abrir o seletor de organização (ADR-004).
 */

export const meUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
});

export const meTenantSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']),
});

export const meResponseSchema = z.object({
  user: meUserSchema,
  tenant: meTenantSchema.nullable(),
  /** Estado do vínculo com a organização ativa. `null` quando não há organização. */
  membershipStatus: z.enum(['ACTIVE', 'REVOKED']).nullable(),
  /** Permissões efetivas do RBAC local, nunca claims do provedor (CLAUDE.md §4.4). */
  permissions: z.array(permissionKeySchema),
  /** Módulos habilitados no tenant. Vazio enquanto não há organização ativa. */
  modules: z.array(z.string()),
});

export type MeUser = z.infer<typeof meUserSchema>;
export type MeTenant = z.infer<typeof meTenantSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
