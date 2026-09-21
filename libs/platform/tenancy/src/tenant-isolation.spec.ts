import { startPostgresTestEnv, type PostgresTestEnv } from '@erp/platform-db/testing';
import { newId, type EntityId } from '@erp/shared-kernel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runInTenantContext } from './tenant-context';
import { TenantDb, type TenantTransaction } from './tenant-db';
import { assertTenantIsolation, type TenantIsolationSubject } from './testing';

let env: PostgresTestEnv;
let tenantDb: TenantDb;

const tenantA: EntityId = newId();
const tenantB: EntityId = newId();

beforeAll(async () => {
  env = await startPostgresTestEnv();
  tenantDb = new TenantDb(env.appPool);

  for (const [tenantId, slug] of [
    [tenantA, 'tenant-a'],
    [tenantB, 'tenant-b'],
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

/** Repositório mínimo de tenant_settings, no formato que o assertTenantIsolation espera. */
function settingsSubject(key: string): TenantIsolationSubject<{ id: string }> {
  return {
    name: 'platform.tenant_settings',
    async insert(tx: TenantTransaction, tenantId: EntityId) {
      const id = newId();
      await tx.client.query(
        'insert into platform.tenant_settings (id, tenant_id, key, value) values ($1, $2, $3, $4)',
        [id, tenantId, key, JSON.stringify({ enabled: true })],
      );
      return { id };
    },
    async findAll(tx: TenantTransaction) {
      const result = await tx.client.query<{ id: string }>(
        'select id from platform.tenant_settings where key = $1',
        [key],
      );
      return result.rows;
    },
  };
}

describe('F0-05 isolamento entre tenants', () => {
  it('tenant não enxerga dados de outro tenant', async () => {
    const subject = settingsSubject('cenario-1');

    await runInTenantContext({ tenantId: tenantA }, () =>
      tenantDb.withTenantTx((tx) => subject.insert(tx, tenantA)),
    );

    const vistoPorA = await runInTenantContext({ tenantId: tenantA }, () =>
      tenantDb.withTenantTx((tx) => subject.findAll(tx)),
    );
    const vistoPorB = await runInTenantContext({ tenantId: tenantB }, () =>
      tenantDb.withTenantTx((tx) => subject.findAll(tx)),
    );

    expect(vistoPorA).toHaveLength(1);
    expect(vistoPorB).toEqual([]);
  });

  it('gravação cruzada bloqueada', async () => {
    const subject = settingsSubject('cenario-2');

    await expect(
      runInTenantContext({ tenantId: tenantB }, () =>
        tenantDb.withTenantTx((tx) => subject.insert(tx, tenantA)),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('sem contexto de tenant, a consulta falha e nada é retornado', async () => {
    const subject = settingsSubject('cenario-3');

    await expect(tenantDb.withTenantTx((tx) => subject.findAll(tx))).rejects.toThrow(
      /Nenhum tenant no contexto/,
    );
  });

  it('nem a dona da tabela escapa da RLS: FORCE está ligado', async () => {
    const forced = await env.ownerPool.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select relrowsecurity, relforcerowsecurity
         from pg_class
        where oid = 'platform.tenant_settings'::regclass`,
    );

    expect(forced.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });

  it('tenants é global: sem RLS, porque é o próprio registro dos tenants', async () => {
    const tenantsTable = await env.ownerPool.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class where oid = 'platform.tenants'::regclass`,
    );

    expect(tenantsTable.rows[0]?.relrowsecurity).toBe(false);
  });
});

describe('F0-05 assertTenantIsolation', () => {
  it('aprova uma tabela com a RLS do ADR-001', async () => {
    await expect(
      assertTenantIsolation(settingsSubject('assercao-ok'), { tenantDb, tenantA, tenantB }),
    ).resolves.toBeUndefined();
  });

  it('reprova uma tabela sem RLS, que é para o que ele serve', async () => {
    await env.ownerPool.query(`
      CREATE TABLE platform.leaky_example (
        id        uuid PRIMARY KEY,
        tenant_id uuid NOT NULL REFERENCES platform.tenants (id),
        key       text NOT NULL
      )
    `);
    await env.ownerPool.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON platform.leaky_example TO app_user',
    );

    const leaky: TenantIsolationSubject<{ id: string }> = {
      name: 'platform.leaky_example',
      async insert(tx, tenantId) {
        const id = newId();
        await tx.client.query(
          'insert into platform.leaky_example (id, tenant_id, key) values ($1, $2, $3)',
          [id, tenantId, 'vazamento'],
        );
        return { id };
      },
      async findAll(tx) {
        const result = await tx.client.query<{ id: string }>(
          'select id from platform.leaky_example',
        );
        return result.rows;
      },
    };

    try {
      await expect(assertTenantIsolation(leaky, { tenantDb, tenantA, tenantB })).rejects.toThrow(
        /vazamento entre tenants/,
      );
    } finally {
      await env.ownerPool.query('DROP TABLE platform.leaky_example');
    }
  });
});

describe('F0-05 TenantDb', () => {
  it('aplica app.tenant_id dentro da transação', async () => {
    const lido = await runInTenantContext({ tenantId: tenantA }, () =>
      tenantDb.withTenantTx(async (tx) => {
        const result = await tx.client.query<{ tenant: string }>(
          "select current_setting('app.tenant_id') as tenant",
        );
        return result.rows[0]?.tenant;
      }),
    );

    expect(lido).toBe(tenantA);
  });

  it('o tenant não sobrevive à transação, então a conexão volta limpa ao pool', async () => {
    await runInTenantContext({ tenantId: tenantA }, () =>
      tenantDb.withTenantTx(async () => undefined),
    );

    // `set_config(..., true)` é local à transação: depois do COMMIT o Postgres devolve
    // string vazia, não o tenant anterior. Uma conexão reaproveitada do pool não herda tenant.
    const result = await env.appPool.query<{ tenant: string | null }>(
      "select current_setting('app.tenant_id', true) as tenant",
    );
    expect(result.rows[0]?.tenant).not.toBe(tenantA);

    // E, sem tenant válido, a tabela de negócio continua inacessível: a política
    // tenta converter '' para uuid e a consulta falha (falha segura do ADR-001).
    await expect(env.appPool.query('select id from platform.tenant_settings')).rejects.toThrow();
  });

  it('desfaz a transação quando o callback falha', async () => {
    const subject = settingsSubject('rollback');

    await expect(
      runInTenantContext({ tenantId: tenantA }, () =>
        tenantDb.withTenantTx(async (tx) => {
          await subject.insert(tx, tenantA);
          throw new Error('falha depois de gravar');
        }),
      ),
    ).rejects.toThrow('falha depois de gravar');

    const sobrou = await runInTenantContext({ tenantId: tenantA }, () =>
      tenantDb.withTenantTx((tx) => subject.findAll(tx)),
    );

    expect(sobrou).toEqual([]);
  });
});
