import { AuditRegistry, AuditService } from '@erp/platform-audit';
import { startPostgresTestEnv, type PostgresTestEnv } from '@erp/platform-db/testing';
import { TenantDb, runInTenantContext } from '@erp/platform-tenancy';
import { newId, type EntityId } from '@erp/shared-kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ModuleCatalog } from './module-catalog';
import { TenantModuleService } from './tenant-module-service';

const TENANT_A: EntityId = newId();
const TENANT_B: EntityId = newId();
const USUARIO: EntityId = newId();

let env: PostgresTestEnv;
let service: TenantModuleService;

function catalogOfThreeModules(): ModuleCatalog {
  const catalog = new ModuleCatalog();
  catalog.register([
    { key: 'platform', description: 'Administração da plataforma' },
    { key: 'projects', description: 'Projetos' },
    { key: 'partners', description: 'Parceiros' },
  ]);
  return catalog;
}

beforeAll(async () => {
  env = await startPostgresTestEnv();
  const tenantDb = new TenantDb(env.appPool);
  service = new TenantModuleService(
    tenantDb,
    catalogOfThreeModules(),
    new AuditService(tenantDb, new AuditRegistry()),
  );

  for (const [tenantId, slug] of [
    [TENANT_A, 'modulos-a'],
    [TENANT_B, 'modulos-b'],
  ] as const) {
    await env.ownerPool.query(
      'insert into platform.tenants (id, clerk_org_id, name, slug) values ($1, $2, $3, $4)',
      [tenantId, `org_${slug}`, slug, slug],
    );
  }
});

afterAll(async () => {
  await env?.stop();
});

describe('F0-13 módulos habilitados por tenant', () => {
  it('tenant sem configuração enxerga todo o catálogo da instalação', async () => {
    expect(await service.enabledModulesOf(TENANT_B)).toEqual(['partners', 'platform', 'projects']);
  });

  it('módulo desabilitado sai da lista do tenant', async () => {
    await service.setEnabled(TENANT_A, 'projects', false, USUARIO);

    expect(await service.enabledModulesOf(TENANT_A)).toEqual(['partners', 'platform']);
    expect(await service.isEnabled(TENANT_A, 'projects')).toBe(false);
  });

  it('desabilitar num tenant não afeta o outro', async () => {
    expect(await service.enabledModulesOf(TENANT_B)).toContain('projects');
  });

  it('reabilitar devolve o módulo à lista sem duplicar a linha', async () => {
    await service.setEnabled(TENANT_A, 'projects', true);

    expect(await service.enabledModulesOf(TENANT_A)).toContain('projects');

    const rows = await runInTenantContext({ tenantId: TENANT_A }, () =>
      new TenantDb(env.appPool).withTenantTx((tx) =>
        tx.client.query<{ version: number }>(
          "select version from platform.tenant_modules where module = 'projects'",
        ),
      ),
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.version).toBe(2);
  });

  it('recusa módulo fora do catálogo', async () => {
    await expect(service.setEnabled(TENANT_A, 'inexistente', false)).rejects.toThrow(
      /não existe no catálogo/,
    );
  });

  it('registra na auditoria quem desabilitou o módulo e o estado anterior', async () => {
    const trilha = await runInTenantContext({ tenantId: TENANT_A }, () =>
      new TenantDb(env.appPool).withTenantTx((tx) =>
        tx.client.query<{ action: string; user_id: string | null; after: { enabled: boolean } }>(
          `select action, user_id, after from platform.audit_log
            where entity = 'tenant_module' order by occurred_at`,
        ),
      ),
    );

    expect(trilha.rows).toHaveLength(2);
    expect(trilha.rows[0]).toMatchObject({ action: 'CREATE', user_id: USUARIO });
    expect(trilha.rows[0]?.after).toEqual({ module: 'projects', enabled: false });
    expect(trilha.rows[1]).toMatchObject({ action: 'UPDATE' });
  });

  it('gravar o mesmo estado não cria versão nem registro de auditoria novos', async () => {
    await service.setEnabled(TENANT_A, 'projects', true);

    const trilha = await runInTenantContext({ tenantId: TENANT_A }, () =>
      new TenantDb(env.appPool).withTenantTx((tx) =>
        tx.client.query("select 1 from platform.audit_log where entity = 'tenant_module'"),
      ),
    );

    expect(trilha.rows).toHaveLength(2);
  });

  it('platform.tenant_modules está sob RLS: um tenant não lê a linha do outro', async () => {
    await service.setEnabled(TENANT_B, 'partners', false);

    const vistoPorA = await runInTenantContext({ tenantId: TENANT_A }, () =>
      new TenantDb(env.appPool).withTenantTx((tx) =>
        tx.client.query("select module from platform.tenant_modules where module = 'partners'"),
      ),
    );

    expect(vistoPorA.rows).toEqual([]);
    expect(await service.enabledModulesOf(TENANT_B)).toEqual(['platform', 'projects']);
  });
});
