import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { Client } from 'pg';
import { DB_ROLES } from '../roles';

/**
 * Executor de migrations (F0-03).
 *
 * Cada módulo é dono do seu schema e guarda as próprias migrations em
 * `src/infra/migrations`. Este executor descobre essas pastas, aplica os arquivos `.sql`
 * em ordem — a plataforma primeiro — e registra o que já rodou em `platform.schema_migrations`.
 *
 * Roda sempre como `app_owner`: é ela que é dona dos schemas e das tabelas.
 */

const MIGRATIONS_DIR = join('src', 'infra', 'migrations');

/**
 * Dona do schema `platform` e das funções SQL compartilhadas (ex.: `enable_tenant_rls`).
 * Roda antes de qualquer outra lib de plataforma, independente da ordem alfabética.
 */
const SCHEMA_OWNER_LIB = 'libs/platform/db';
const LEDGER_SCHEMA = 'platform';
const LEDGER_TABLE = 'schema_migrations';

export interface MigrationSet {
  /** Caminho da lib dona das migrations, relativo à raiz do workspace (ex.: `libs/modules/projects`). */
  readonly module: string;
  /** Caminho absoluto da pasta de migrations. */
  readonly dir: string;
}

export interface AppliedMigration {
  readonly module: string;
  readonly name: string;
}

export interface RunMigrationsOptions {
  readonly workspaceRoot?: string;
  /** Recebe cada migration aplicada, na ordem. Útil para log da CLI. */
  readonly onApplied?: (migration: AppliedMigration) => void;
}

/**
 * Sobe até a raiz do workspace a partir de um diretório qualquer.
 */
export function findWorkspaceRoot(from: string = __dirname): string {
  let current = from;
  for (;;) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Raiz do workspace não encontrada a partir de ${from}.`);
    }
    current = parent;
  }
}

/**
 * Pastas de migrations em ordem de aplicação: plataforma primeiro, módulos depois,
 * cada grupo em ordem alfabética para que o resultado seja sempre o mesmo.
 */
export function discoverMigrationSets(workspaceRoot: string): readonly MigrationSet[] {
  const platform = setsUnder(workspaceRoot, join(workspaceRoot, 'libs', 'platform'));
  const schemaOwner = platform.filter((set) => set.module === SCHEMA_OWNER_LIB);
  const otherPlatform = platform.filter((set) => set.module !== SCHEMA_OWNER_LIB);

  return [
    ...schemaOwner,
    ...otherPlatform,
    ...setsUnder(workspaceRoot, join(workspaceRoot, 'libs', 'modules')),
  ];
}

function setsUnder(workspaceRoot: string, parent: string): readonly MigrationSet[] {
  if (!existsSync(parent)) {
    return [];
  }

  return readdirSync(parent)
    .filter((entry) => statSync(join(parent, entry)).isDirectory())
    .sort()
    .map((entry) => ({
      module: relative(workspaceRoot, join(parent, entry)).split(sep).join('/'),
      dir: join(parent, entry, MIGRATIONS_DIR),
    }))
    .filter((set) => existsSync(set.dir));
}

function migrationFilesOf(dir: string): readonly string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

function checksumOf(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

export async function runMigrations(
  ownerUrl: string,
  options: RunMigrationsOptions = {},
): Promise<readonly AppliedMigration[]> {
  const workspaceRoot = options.workspaceRoot ?? findWorkspaceRoot();
  const sets = discoverMigrationSets(workspaceRoot);

  const client = new Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await ensureLedger(client);
    const applied: AppliedMigration[] = [];

    for (const set of sets) {
      for (const name of migrationFilesOf(set.dir)) {
        const contents = readFileSync(join(set.dir, name), 'utf8');
        const wasApplied = await applyMigration(client, set.module, name, contents);
        if (wasApplied) {
          applied.push({ module: set.module, name });
          options.onApplied?.({ module: set.module, name });
        }
      }
    }

    return applied;
  } finally {
    await client.end();
  }
}

async function ensureLedger(client: Client): Promise<void> {
  const schema = client.escapeIdentifier(LEDGER_SCHEMA);
  await client.query(
    `CREATE SCHEMA IF NOT EXISTS ${schema} AUTHORIZATION ${client.escapeIdentifier(DB_ROLES.owner)}`,
  );
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.${client.escapeIdentifier(LEDGER_TABLE)} (
      module      text        NOT NULL,
      name        text        NOT NULL,
      checksum    text        NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (module, name)
    )
  `);
}

/** Retorna `true` se a migration foi aplicada agora, `false` se já estava aplicada. */
async function applyMigration(
  client: Client,
  module: string,
  name: string,
  contents: string,
): Promise<boolean> {
  const ledger = `${client.escapeIdentifier(LEDGER_SCHEMA)}.${client.escapeIdentifier(LEDGER_TABLE)}`;
  const checksum = checksumOf(contents);

  const previous = await client.query<{ checksum: string }>(
    `select checksum from ${ledger} where module = $1 and name = $2`,
    [module, name],
  );

  const previousChecksum = previous.rows[0]?.checksum;
  if (previousChecksum !== undefined) {
    if (previousChecksum !== checksum) {
      throw new Error(
        `A migration ${module}/${name} já foi aplicada com outro conteúdo. ` +
          'Migrations aplicadas são imutáveis: crie uma nova em vez de editar esta.',
      );
    }
    return false;
  }

  await client.query('BEGIN');
  try {
    await client.query(contents);
    await client.query(`insert into ${ledger} (module, name, checksum) values ($1, $2, $3)`, [
      module,
      name,
      checksum,
    ]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Falha ao aplicar a migration ${module}/${name}: ${String(error)}`, {
      cause: error,
    });
  }
}
