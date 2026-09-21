import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { createDb, createDbPool, type Db } from '../connection';
import { bootstrapRoles } from '../infra/bootstrap';
import { runMigrations, type AppliedMigration } from '../infra/migration-runner';
import { DB_ROLES } from '../roles';

/**
 * Postgres real para os testes de integração (F0-03).
 *
 * Sobe um contêiner, cria as roles do ADR-001, aplica as migrations de todos os módulos e
 * devolve conexões prontas como `app_owner`, `app_user` e `app_platform`. Os testes de
 * isolamento entre tenants dos módulos (CLAUDE.md §4.1) partem daqui.
 */

export const POSTGRES_IMAGE = 'postgres:16-alpine';
const ADMIN_USER = 'postgres';
const ADMIN_PASSWORD = 'postgres';
const DATABASE = 'erp';

/** Senhas das roles no ambiente de teste. Nada aqui chega perto de produção. */
const TEST_PASSWORDS = {
  owner: 'app_owner_test',
  app: 'app_user_test',
  platform: 'app_platform_test',
} as const;

export interface PostgresTestEnv {
  readonly adminUrl: string;
  readonly ownerUrl: string;
  readonly appUrl: string;
  readonly platformUrl: string;
  /** Conexão como `app_owner`: dona dos schemas, usada por migrations e montagem de cenário. */
  readonly ownerPool: Pool;
  /** Conexão como `app_user`: a mesma role da aplicação, sujeita à RLS. */
  readonly appPool: Pool;
  /** Conexão como `app_platform`: rotinas que atravessam tenants na plataforma. */
  readonly platformPool: Pool;
  readonly ownerDb: Db;
  readonly appDb: Db;
  readonly platformDb: Db;
  stop(): Promise<void>;
}

export interface StartPostgresTestEnvOptions {
  /** Aplica as migrations de todos os módulos ao subir. Padrão: `true`. */
  readonly migrate?: boolean;
  readonly workspaceRoot?: string;
}

export async function startPostgresTestEnv(
  options: StartPostgresTestEnvOptions = {},
): Promise<PostgresTestEnv> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase(DATABASE)
    .withUsername(ADMIN_USER)
    .withPassword(ADMIN_PASSWORD)
    .start();

  const adminUrl = container.getConnectionUri();
  const ownerUrl = urlForRole(container, DB_ROLES.owner, TEST_PASSWORDS.owner);
  const appUrl = urlForRole(container, DB_ROLES.app, TEST_PASSWORDS.app);
  const platformUrl = urlForRole(container, DB_ROLES.platform, TEST_PASSWORDS.platform);

  await bootstrapRoles(adminUrl, TEST_PASSWORDS);

  if (options.migrate !== false) {
    await applyMigrations(ownerUrl, options.workspaceRoot);
  }

  const ownerPool = createDbPool(ownerUrl, { max: 4, applicationName: 'erp-test-owner' });
  const appPool = createDbPool(appUrl, { max: 4, applicationName: 'erp-test-app' });
  const platformPool = createDbPool(platformUrl, { max: 4, applicationName: 'erp-test-platform' });

  return {
    adminUrl,
    ownerUrl,
    appUrl,
    platformUrl,
    ownerPool,
    appPool,
    platformPool,
    ownerDb: createDb(ownerPool),
    appDb: createDb(appPool),
    platformDb: createDb(platformPool),
    async stop(): Promise<void> {
      await Promise.all([ownerPool.end(), appPool.end(), platformPool.end()]);
      await container.stop();
    },
  };
}

/** Reaplica as migrations num ambiente já de pé. Usado para provar idempotência. */
export function applyMigrations(
  ownerUrl: string,
  workspaceRoot?: string,
): Promise<readonly AppliedMigration[]> {
  return runMigrations(ownerUrl, workspaceRoot === undefined ? {} : { workspaceRoot });
}

function urlForRole(container: StartedPostgreSqlContainer, role: string, password: string): string {
  const url = new URL(container.getConnectionUri());
  url.username = encodeURIComponent(role);
  url.password = encodeURIComponent(password);
  return url.toString();
}
