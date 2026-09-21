import { sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/** Schema Postgres da plataforma. Espelha as migrations das libs de plataforma. */
const platform = pgSchema('platform');

export const tenantStatus = pgEnum('tenant_status', ['ACTIVE', 'SUSPENDED', 'CANCELLED']);

/** Registro de tenants: global, sem `tenant_id` e sem RLS (ADR-001). */
export const tenants = platform.table('tenants', {
  id: uuid('id').primaryKey(),
  clerkOrgId: text('clerk_org_id').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  status: tenantStatus('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Parâmetros por tenant. Tabela de negócio: tem `tenant_id` e RLS. */
export const tenantSettings = platform.table(
  'tenant_settings',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by'),
    version: integer('version').notNull().default(1),
  },
  (table) => [unique('tenant_settings_tenant_key_unique').on(table.tenantId, table.key)],
);

/** `set_config('app.tenant_id', ..., true)` — o nome do parâmetro usado pelas políticas RLS. */
export const TENANT_ID_SETTING = 'app.tenant_id';

/** Lê o tenant aplicado na transação corrente. Útil em teste e diagnóstico. */
export const currentTenantId = sql<string>`current_setting(${TENANT_ID_SETTING}, true)`;
