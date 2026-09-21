/**
 * Roles do banco (ADR-001).
 *
 * - `app_owner`: dona dos schemas e das tabelas; roda as migrations. Não é usada pela aplicação.
 * - `app_user`: conexão da aplicação. Sem `BYPASSRLS` e sem ser dona de nada, para que a RLS
 *   valha sempre.
 * - `app_platform`: rotinas de plataforma que atravessam tenants (ex.: publicação do outbox),
 *   restrita aos schemas de plataforma.
 */
export const DB_ROLES = {
  owner: 'app_owner',
  app: 'app_user',
  platform: 'app_platform',
} as const;

export type DbRole = (typeof DB_ROLES)[keyof typeof DB_ROLES];
