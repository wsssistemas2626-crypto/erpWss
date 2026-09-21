import type { EntityId } from '@erp/shared-kernel';
import type { Pool, PoolClient } from 'pg';

/**
 * Executa SQL de fixture no contexto de um tenant.
 *
 * Existe porque `FORCE ROW LEVEL SECURITY` vale inclusive para a dona da tabela: montar
 * cenário direto no pool, sem `app.tenant_id`, falha com "unrecognized configuration
 * parameter". Diferente do `TenantDb.withTenantTx`, aqui o tenant vem por parâmetro — é
 * exatamente o que um fixture precisa e exatamente o que o código de produção não pode ter.
 */
export async function withTenantSession<T>(
  pool: Pool,
  tenantId: EntityId,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('select set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // o erro que importa é o original
    }
    throw error;
  } finally {
    client.release();
  }
}
