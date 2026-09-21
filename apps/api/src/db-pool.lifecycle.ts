import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from './tokens';

/**
 * Fecha o pool quando a aplicação encerra.
 *
 * Sem isso, conexões ficam abertas depois do `app.close()` — o processo não termina
 * sozinho em produção e, no teste, o Postgres derruba as conexões e o erro aparece
 * fora de qualquer teste.
 */
@Injectable()
export class DbPoolLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
