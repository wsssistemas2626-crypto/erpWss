import { boolean, integer, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tenants } from '@erp/platform-tenancy';

/** Schema Postgres da plataforma. Espelha a migration `0001_tenant_modules.sql`. */
const platform = pgSchema('platform');

/**
 * Módulos desabilitados por tenant. Tabela de negócio: tem `tenant_id` e RLS.
 *
 * Ausência de linha significa habilitado: o catálogo de módulos do produto está no código
 * e um tenant novo enxerga tudo o que a instalação oferece.
 */
export const tenantModules = platform.table(
  'tenant_modules',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    module: text('module').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by'),
    version: integer('version').notNull().default(1),
  },
  (table) => [unique('tenant_modules_tenant_module_unique').on(table.tenantId, table.module)],
);
