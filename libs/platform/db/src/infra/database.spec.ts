import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations, startPostgresTestEnv, type PostgresTestEnv } from '../testing';
import { DB_ROLES } from '../roles';
import { discoverMigrationSets, findWorkspaceRoot, runMigrations } from './migration-runner';

let env: PostgresTestEnv;

beforeAll(async () => {
  env = await startPostgresTestEnv();
});

afterAll(async () => {
  await env?.stop();
});

async function scalar<T>(sql: string, params: readonly unknown[] = []): Promise<T> {
  const result = await env.ownerPool.query(sql, [...params]);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (row === undefined) {
    throw new Error(`A consulta não retornou linha nenhuma: ${sql}`);
  }
  return Object.values(row)[0] as T;
}

describe('F0-03 roles da aplicação', () => {
  it('a role da aplicação não ignora RLS e não é dona de nenhuma tabela', async () => {
    const role = await env.ownerPool.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      'select rolsuper, rolbypassrls from pg_roles where rolname = $1',
      [DB_ROLES.app],
    );

    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });

    const ownedTables = await scalar<string>(
      'select count(*) from pg_tables where tableowner = $1',
      [DB_ROLES.app],
    );
    expect(ownedTables).toBe('0');
  });

  it('nenhuma das três roles é superusuária nem ignora RLS', async () => {
    const roles = await env.ownerPool.query<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(
      'select rolname, rolsuper, rolbypassrls from pg_roles where rolname = any($1) order by rolname',
      [[DB_ROLES.owner, DB_ROLES.app, DB_ROLES.platform]],
    );

    expect(roles.rows).toHaveLength(3);
    for (const role of roles.rows) {
      expect({ [role.rolname]: [role.rolsuper, role.rolbypassrls] }).toEqual({
        [role.rolname]: [false, false],
      });
    }
  });

  it('app_user conecta com a própria role', async () => {
    const who = await env.appPool.query<{ current_user: string }>('select current_user');

    expect(who.rows[0]?.current_user).toBe(DB_ROLES.app);
  });
});

describe('F0-03 schemas dos módulos', () => {
  it('cria os schemas platform, organization, partners e projects, todos de app_owner', async () => {
    const schemas = await env.ownerPool.query<{ nspname: string; owner: string }>(
      `select n.nspname, pg_get_userbyid(n.nspowner) as owner
         from pg_namespace n
        where n.nspname = any($1)
        order by n.nspname`,
      [['organization', 'partners', 'platform', 'projects']],
    );

    expect(schemas.rows).toEqual([
      { nspname: 'organization', owner: DB_ROLES.owner },
      { nspname: 'partners', owner: DB_ROLES.owner },
      { nspname: 'platform', owner: DB_ROLES.owner },
      { nspname: 'projects', owner: DB_ROLES.owner },
    ]);
  });

  it('app_user enxerga os schemas mas não pode criar objetos neles', async () => {
    const usage = await scalar<boolean>('select has_schema_privilege($1, $2, $3)', [
      DB_ROLES.app,
      'projects',
      'USAGE',
    ]);
    const create = await scalar<boolean>('select has_schema_privilege($1, $2, $3)', [
      DB_ROLES.app,
      'projects',
      'CREATE',
    ]);

    expect({ usage, create }).toEqual({ usage: true, create: false });
  });

  it('app_platform alcança a plataforma mas não os schemas de módulo', async () => {
    const platform = await scalar<boolean>('select has_schema_privilege($1, $2, $3)', [
      DB_ROLES.platform,
      'platform',
      'USAGE',
    ]);
    const projects = await scalar<boolean>('select has_schema_privilege($1, $2, $3)', [
      DB_ROLES.platform,
      'projects',
      'USAGE',
    ]);

    expect({ platform, projects }).toEqual({ platform: true, projects: false });
  });
});

describe('F0-03 execução das migrations', () => {
  it('descobre as pastas de migrations com a plataforma primeiro', () => {
    const modules = discoverMigrationSets(findWorkspaceRoot()).map((set) => set.module);

    // libs/platform/db é dona do schema e das funções SQL compartilhadas, então vem
    // antes de qualquer outra lib de plataforma, mesmo fora da ordem alfabética.
    expect(modules[0]).toBe('libs/platform/db');

    const plataforma = modules.filter((module) => module.startsWith('libs/platform/'));
    const modulos = modules.filter((module) => module.startsWith('libs/modules/'));

    expect(modules).toEqual([...plataforma, ...modulos]);
    expect(modulos).toEqual([...modulos].sort());
    expect(plataforma).toContain('libs/platform/tenancy');
  });

  it('registra no ledger o que foi aplicado, na ordem em que rodou', async () => {
    const ledger = await env.ownerPool.query<{ module: string; name: string }>(
      'select module, name from platform.schema_migrations order by applied_at, name',
    );
    const modules = ledger.rows.map((row) => row.module);

    // A ordem dos módulos no ledger é a mesma que a descoberta produz.
    const esperada = discoverMigrationSets(findWorkspaceRoot()).map((set) => set.module);
    expect([...new Set(modules)]).toEqual(esperada);
    expect(modules[0]).toBe('libs/platform/db');
    expect(ledger.rows[0]?.name).toBe('0001_platform_schema.sql');
    expect(modules.lastIndexOf('libs/platform/tenancy')).toBeLessThan(
      modules.indexOf('libs/modules/organization'),
    );
  });

  it('é idempotente: aplicar de novo não roda nada', async () => {
    const applied = await applyMigrations(env.ownerUrl);

    expect(applied).toEqual([]);
  });

  it('recusa uma migration já aplicada cujo conteúdo mudou', async () => {
    const root = mkdtempSync(join(tmpdir(), 'erp-migrations-'));
    const dir = join(root, 'libs', 'platform', 'exemplo', 'src', 'infra', 'migrations');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, '0001_exemplo.sql');

    try {
      writeFileSync(file, 'SELECT 1;\n');
      await runMigrations(env.ownerUrl, { workspaceRoot: root });

      writeFileSync(file, 'SELECT 2;\n');
      await expect(runMigrations(env.ownerUrl, { workspaceRoot: root })).rejects.toThrow(
        /já foi aplicada com outro conteúdo/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
