import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type Client, type PoolClient, type PoolConfig } from 'pg';

export type Db = ReturnType<typeof drizzle>;

export interface DbPoolOptions {
  readonly max?: number;
  readonly applicationName?: string;
}

/**
 * Pool de conexões do Postgres. Todo acesso ao banco em contexto de requisição
 * passa pelo `TenantDb` (item F0-05), nunca por este pool diretamente.
 */
export function createDbPool(connectionString: string, options: DbPoolOptions = {}): Pool {
  const config: PoolConfig = {
    connectionString,
    max: options.max ?? 10,
    application_name: options.applicationName ?? 'erp',
  };
  return new Pool(config);
}

/** Aceita pool, cliente do pool ou cliente avulso: o `TenantDb` amarra o Drizzle à conexão da transação. */
export type DbConnection = Pool | PoolClient | Client;

export function createDb(connection: DbConnection): Db {
  return drizzle(connection);
}
