import { startPostgresTestEnv, type PostgresTestEnv } from '@erp/platform-db/testing';
import { runInTenantContext, TenantDb } from '@erp/platform-tenancy';
import { withTenantSession } from '@erp/platform-tenancy/testing';
import { newId, type EntityId } from '@erp/shared-kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditRegistry } from './audit-registry';
import { AuditService } from './audit-service';

const TENANT: EntityId = newId();
const ATOR: EntityId = newId();

let env: PostgresTestEnv;
let audit: AuditService;
let tenantDb: TenantDb;

beforeAll(async () => {
  env = await startPostgresTestEnv();
  tenantDb = new TenantDb(env.appPool);

  const registry = new AuditRegistry();
  registry.register([{ module: 'partners', entity: 'partner', piiFields: ['tradeName'] }]);
  audit = new AuditService(tenantDb, registry);

  await env.ownerPool.query(
    `insert into platform.tenants (id, clerk_org_id, name, slug) values ($1, 'org_audit', 'Audit', 'audit')`,
    [TENANT],
  );
  await env.ownerPool.query(
    'insert into platform.users (id, clerk_user_id, email, name) values ($1, $2, $3, $4)',
    [ATOR, 'user_audit', 'ator@example.com', 'Ator'],
  );
});

afterAll(async () => {
  await env?.stop();
});

function record(entry: Parameters<AuditService['record']>[1]) {
  return runInTenantContext({ tenantId: TENANT }, () =>
    tenantDb.withTenantTx((tx) => audit.record(tx, entry)),
  );
}

describe('F0-09 auditoria imutável (RNF031)', () => {
  it('a role da aplicação tem SELECT e INSERT, mas não UPDATE nem DELETE', async () => {
    const grants = await env.ownerPool.query<{ privilege_type: string }>(
      `select privilege_type
         from information_schema.role_table_grants
        where grantee = 'app_user' and table_schema = 'platform' and table_name = 'audit_log'
        order by privilege_type`,
    );

    expect(grants.rows.map((row) => row.privilege_type)).toEqual(['INSERT', 'SELECT']);
  });

  it('o banco nega UPDATE e DELETE feitos pela role da aplicação', async () => {
    const registro = await record({
      module: 'platform',
      entity: 'role',
      entityId: newId(),
      action: 'CREATE',
      userId: ATOR,
      after: { name: 'Financeiro' },
    });

    await expect(
      runInTenantContext({ tenantId: TENANT }, () =>
        tenantDb.withTenantTx((tx) =>
          tx.client.query('update platform.audit_log set action = $1 where id = $2', [
            'DELETE',
            registro.id,
          ]),
        ),
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      runInTenantContext({ tenantId: TENANT }, () =>
        tenantDb.withTenantTx((tx) =>
          tx.client.query('delete from platform.audit_log where id = $1', [registro.id]),
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe('F0-09 registro na transação do caso de uso', () => {
  it('o registro desfaz junto com a escrita de negócio', async () => {
    const entityId = newId();

    await expect(
      runInTenantContext({ tenantId: TENANT }, () =>
        tenantDb.withTenantTx(async (tx) => {
          await audit.record(tx, {
            module: 'platform',
            entity: 'role',
            entityId,
            action: 'CREATE',
            userId: ATOR,
            after: { name: 'Some depois' },
          });
          throw new Error('a escrita de negócio falhou');
        }),
      ),
    ).rejects.toThrow('a escrita de negócio falhou');

    const encontrado = await audit.findByEntity(TENANT, {
      entity: 'role',
      entityId,
      offset: 0,
      limit: 10,
    });

    expect(encontrado.total).toBe(0);
  });

  it('grava quem, quando, o antes e o depois', async () => {
    const entityId = newId();

    await record({
      module: 'platform',
      entity: 'role',
      entityId,
      action: 'UPDATE',
      userId: ATOR,
      before: { name: 'Financeiro' },
      after: { name: 'Financeiro Sênior' },
    });

    const { items, total } = await audit.findByEntity(TENANT, {
      entity: 'role',
      entityId,
      offset: 0,
      limit: 10,
    });

    expect(total).toBe(1);
    expect(items[0]).toMatchObject({
      action: 'UPDATE',
      userId: ATOR,
      module: 'platform',
      entity: 'role',
      before: { name: 'Financeiro' },
      after: { name: 'Financeiro Sênior' },
    });
    expect(items[0]?.occurredAt).toBeInstanceOf(Date);
  });

  it('aceita ação de sistema, sem usuário', async () => {
    const entityId = newId();

    await record({
      module: 'platform',
      entity: 'tenant',
      entityId,
      action: 'CREATE',
      after: { name: 'Provisionado pelo webhook' },
    });

    const { items } = await audit.findByEntity(TENANT, {
      entity: 'tenant',
      entityId,
      offset: 0,
      limit: 10,
    });

    expect(items[0]?.userId).toBeUndefined();
  });

  it('devolve do mais recente ao mais antigo, paginado', async () => {
    const entityId = newId();
    for (const nome of ['um', 'dois', 'tres']) {
      await record({
        module: 'platform',
        entity: 'role',
        entityId,
        action: 'UPDATE',
        userId: ATOR,
        after: { name: nome },
      });
    }

    const pagina = await audit.findByEntity(TENANT, {
      entity: 'role',
      entityId,
      offset: 0,
      limit: 2,
    });

    expect(pagina.total).toBe(3);
    expect(pagina.items).toHaveLength(2);
    expect(pagina.items[0]?.after).toEqual({ name: 'tres' });
  });
});

describe('F0-09 PII na trilha', () => {
  it('mascara os campos PII declarados pelo módulo', async () => {
    const entityId = newId();

    await record({
      module: 'partners',
      entity: 'partner',
      entityId,
      action: 'CREATE',
      userId: ATOR,
      after: { name: 'ACME', tradeName: 'ACME Ltda', email: 'contato@acme.com' },
    });

    const { items } = await audit.findByEntity(TENANT, {
      entity: 'partner',
      entityId,
      offset: 0,
      limit: 10,
    });
    const after = items[0]?.after as Record<string, unknown>;

    expect(after.name).toBe('ACME');
    expect(String(after.tradeName)).toMatch(/^pii:/);
    expect(String(after.email)).toMatch(/^pii:/);
  });
});

describe('F0-09 isolamento entre tenants', () => {
  it('um tenant não enxerga a trilha do outro', async () => {
    const outroTenant = newId();
    const entityId = newId();
    await env.ownerPool.query(
      `insert into platform.tenants (id, clerk_org_id, name, slug) values ($1, 'org_audit_2', 'Outro', 'outro')`,
      [outroTenant],
    );

    await record({
      module: 'platform',
      entity: 'role',
      entityId,
      action: 'CREATE',
      userId: ATOR,
      after: { name: 'Só do tenant 1' },
    });

    const vistoPeloOutro = await audit.findByEntity(outroTenant, {
      entity: 'role',
      entityId,
      offset: 0,
      limit: 10,
    });

    expect(vistoPeloOutro.total).toBe(0);
    await withTenantSession(env.ownerPool, TENANT, async () => undefined);
  });
});
