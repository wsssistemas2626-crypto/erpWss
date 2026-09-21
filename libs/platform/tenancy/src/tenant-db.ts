import { createDb, type Db } from '@erp/platform-db';
import type { EntityId } from '@erp/shared-kernel';
import type { Pool, PoolClient } from 'pg';
import { requireTenantId } from './tenant-context';

/** Conexão dentro da transação do tenant. Fora dela nada de negócio é lido nem escrito. */
export interface TenantTransaction {
  readonly tenantId: EntityId;
  /** Cliente pg da transação, para SQL cru. */
  readonly client: PoolClient;
  /** Drizzle amarrado à mesma conexão — e, portanto, ao mesmo `app.tenant_id`. */
  readonly db: Db;
}

/**
 * Único caminho de acesso ao banco em contexto de requisição (CLAUDE.md §4.1).
 *
 * Abre a transação, aplica `set_config('app.tenant_id', ..., true)` — `true` faz o
 * valor durar só até o fim da transação, então uma conexão devolvida ao pool nunca
 * leva o tenant anterior junto — e só então entrega a conexão ao chamador.
 */
export class TenantDb {
  constructor(private readonly pool: Pool) {}

  async withTenantTx<T>(fn: (tx: TenantTransaction) => Promise<T>): Promise<T> {
    const tenantId = requireTenantId();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('select set_config($1, $2, true)', ['app.tenant_id', tenantId]);

      const result = await fn({ tenantId, client, db: createDb(client) });

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

/** Se a conexão já caiu, o ROLLBACK também falha: o erro que importa é o original. */
async function rollbackQuietly(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // ignorado de propósito
  }
}
