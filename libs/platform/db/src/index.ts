/**
 * Superfície pública de @erp/platform-db.
 * Conexão (Drizzle + pg), roles do ADR-001 e execução das migrations de cada módulo.
 *
 * Os utilitários de teste com Testcontainers ficam em `@erp/platform-db/testing`,
 * fora desta entrada, para que nada de teste entre no bundle da aplicação.
 */
export {
  createDb,
  createDbPool,
  type Db,
  type DbConnection,
  type DbPoolOptions,
} from './connection';
export { DB_ROLES, type DbRole } from './roles';
export { bootstrapRoles, type RolePasswords } from './infra/bootstrap';
export {
  discoverMigrationSets,
  findWorkspaceRoot,
  runMigrations,
  type AppliedMigration,
  type MigrationSet,
  type RunMigrationsOptions,
} from './infra/migration-runner';
