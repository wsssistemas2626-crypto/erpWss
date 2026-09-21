/**
 * Superfície pública de @erp/platform-db/testing.
 * Só para testes: sobe um Postgres real com Testcontainers, já migrado.
 */
export {
  applyMigrations,
  startPostgresTestEnv,
  POSTGRES_IMAGE,
  type PostgresTestEnv,
  type StartPostgresTestEnvOptions,
} from './postgres-test-env';
