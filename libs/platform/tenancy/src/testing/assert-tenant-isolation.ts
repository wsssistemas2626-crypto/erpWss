import type { EntityId } from '@erp/shared-kernel';
import { runInTenantContext } from '../tenant-context';
import type { TenantDb, TenantTransaction } from '../tenant-db';

/**
 * Contrato mínimo que um repositório precisa expor para ser submetido ao teste de
 * isolamento. Deliberadamente pequeno: qualquer módulo consegue implementá-lo em
 * poucas linhas sobre o seu próprio repositório.
 */
export interface TenantIsolationSubject<T> {
  /** Nome da tabela/entidade, só para a mensagem de erro. */
  readonly name: string;
  /**
   * Insere um registro gravando explicitamente este `tenantId`. Precisa ser explícito
   * para que o teste consiga tentar a gravação cruzada.
   */
  insert(tx: TenantTransaction, tenantId: EntityId): Promise<T>;
  /** Registros visíveis no tenant corrente. */
  findAll(tx: TenantTransaction): Promise<readonly T[]>;
}

export interface TenantIsolationOptions {
  readonly tenantDb: TenantDb;
  readonly tenantA: EntityId;
  readonly tenantB: EntityId;
}

/**
 * Prova que a RLS do ADR-001 está de pé para um repositório (CLAUDE.md §4.1:
 * todo módulo novo com tabelas tem teste de isolamento entre tenants).
 *
 * Cobre os três cenários do F0-05:
 *   1. o tenant B não enxerga registro do tenant A;
 *   2. o tenant B não consegue gravar com o tenant_id do tenant A;
 *   3. sem tenant no contexto, a operação falha e nada é lido.
 *
 * Lança `Error` com mensagem explicativa — não depende de framework de teste,
 * para poder ser chamado de qualquer lugar.
 */
export async function assertTenantIsolation<T>(
  subject: TenantIsolationSubject<T>,
  options: TenantIsolationOptions,
): Promise<void> {
  const { tenantDb, tenantA, tenantB } = options;

  await runInTenantContext({ tenantId: tenantA }, () =>
    tenantDb.withTenantTx(async (tx) => {
      await subject.insert(tx, tenantA);
    }),
  );

  const seenByA = await runInTenantContext({ tenantId: tenantA }, () =>
    tenantDb.withTenantTx((tx) => subject.findAll(tx)),
  );
  if (seenByA.length === 0) {
    throw new Error(
      `${subject.name}: o tenant que gravou o registro não o enxerga de volta. ` +
        'A política RLS está filtrando demais ou o insert não gravou o tenant_id correto.',
    );
  }

  const seenByB = await runInTenantContext({ tenantId: tenantB }, () =>
    tenantDb.withTenantTx((tx) => subject.findAll(tx)),
  );
  if (seenByB.length > 0) {
    throw new Error(
      `${subject.name}: vazamento entre tenants — o tenant B enxergou ${String(seenByB.length)} ` +
        'registro(s) do tenant A. Confira ENABLE/FORCE ROW LEVEL SECURITY e a política.',
    );
  }

  await assertCrossTenantWriteIsRejected(subject, options);
  await assertNoContextIsRejected(subject, tenantDb);
}

async function assertCrossTenantWriteIsRejected<T>(
  subject: TenantIsolationSubject<T>,
  { tenantDb, tenantA, tenantB }: TenantIsolationOptions,
): Promise<void> {
  let rejected = false;
  try {
    await runInTenantContext({ tenantId: tenantB }, () =>
      tenantDb.withTenantTx(async (tx) => {
        await subject.insert(tx, tenantA);
      }),
    );
  } catch {
    rejected = true;
  }

  if (!rejected) {
    throw new Error(
      `${subject.name}: o tenant B conseguiu gravar um registro com o tenant_id do tenant A. ` +
        'Falta o WITH CHECK na política RLS.',
    );
  }
}

async function assertNoContextIsRejected<T>(
  subject: TenantIsolationSubject<T>,
  tenantDb: TenantDb,
): Promise<void> {
  let rejected = false;
  try {
    await tenantDb.withTenantTx((tx) => subject.findAll(tx));
  } catch {
    rejected = true;
  }

  if (!rejected) {
    throw new Error(
      `${subject.name}: a consulta funcionou sem tenant no contexto. ` +
        'O acesso precisa falhar quando não há tenant (falha segura do ADR-001).',
    );
  }
}
