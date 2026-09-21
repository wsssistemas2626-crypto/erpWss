import type { ApiEnv } from '@erp/platform-config';
import { createDbPool } from '@erp/platform-db';
import { CorrelationIdMiddleware } from '@erp/platform-http';
import { TenantDb } from '@erp/platform-tenancy';
import {
  Module,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { DbPoolLifecycle } from './db-pool.lifecycle';
import { HealthController } from './health/health.controller';
import { API_ENV, DB_POOL } from './tokens';

/**
 * Composição da API (CLAUDE.md §5: `apps/api` só monta, não tem regra de negócio).
 *
 * A configuração entra por parâmetro em vez de ser lida aqui dentro: assim o teste
 * monta o mesmo módulo apontando para outro banco, sem mexer em variável de ambiente.
 */
@Module({})
export class AppModule implements NestModule {
  static forRoot(env: ApiEnv): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [
        { provide: API_ENV, useValue: env },
        {
          provide: DB_POOL,
          useFactory: (): Pool =>
            createDbPool(env.DATABASE_URL_APP, { applicationName: 'erp-api' }),
        },
        {
          provide: TenantDb,
          useFactory: (pool: Pool): TenantDb => new TenantDb(pool),
          inject: [DB_POOL],
        },
        DbPoolLifecycle,
      ],
      exports: [DB_POOL, TenantDb, API_ENV],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    // `{*splat}` é a sintaxe de curinga do Express 5, usado pelo NestJS 12.
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*splat}');
  }
}
