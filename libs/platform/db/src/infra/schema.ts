import { pgSchema } from 'drizzle-orm/pg-core';

/**
 * Schema Postgres da plataforma (ADR-002: um schema por módulo).
 * As tabelas entram a partir do F0-05 (`platform.tenants`).
 */
export const platformSchema = pgSchema('platform');
