import type { ApiEnv } from '@erp/platform-config';
import { createDbPool } from '@erp/platform-db';
import { CorrelationIdMiddleware } from '@erp/platform-http';
import {
  AuthGuard,
  AuthenticationMiddleware,
  ClerkIdentityProvider,
  IDENTITY_PROVIDER,
  IdentityRepository,
  MeController,
  type IdentityProvider,
} from '@erp/platform-iam';
import { TenantDb } from '@erp/platform-tenancy';
import {
  Module,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { Pool } from 'pg';
import { DbPoolLifecycle } from './db-pool.lifecycle';
import { HealthController } from './health/health.controller';
import { API_ENV, DB_POOL } from './tokens';

export interface AppModuleOverrides {
  /** Substitui o provedor de identidade. O teste injeta o `FakeIdentityProvider` (ADR-004). */
  readonly identityProvider?: IdentityProvider;
}

/**
 * Composição da API (CLAUDE.md §5: `apps/api` só monta, não tem regra de negócio).
 *
 * A configuração entra por parâmetro em vez de ser lida aqui dentro: assim o teste monta
 * o mesmo módulo apontando para outro banco e outro provedor de identidade, sem mexer em
 * variável de ambiente.
 */
@Module({})
export class AppModule implements NestModule {
  static forRoot(env: ApiEnv, overrides: AppModuleOverrides = {}): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, MeController],
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
        {
          provide: IDENTITY_PROVIDER,
          useFactory: (): IdentityProvider =>
            overrides.identityProvider ??
            new ClerkIdentityProvider({
              jwtKey: env.CLERK_JWT_KEY,
              secretKey: env.CLERK_SECRET_KEY,
              authorizedParties: env.CLERK_AUTHORIZED_PARTIES,
            }),
        },
        {
          provide: IdentityRepository,
          useFactory: (pool: Pool, tenantDb: TenantDb): IdentityRepository =>
            new IdentityRepository(pool, tenantDb),
          inject: [DB_POOL, TenantDb],
        },
        // Nega por padrão: rota sem @Public exige token válido (ADR-004).
        { provide: APP_GUARD, useClass: AuthGuard },
        DbPoolLifecycle,
      ],
      exports: [DB_POOL, TenantDb, API_ENV, IDENTITY_PROVIDER, IdentityRepository],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    // A ordem importa: a correlação precisa existir antes de qualquer log da autenticação.
    // `{*splat}` é a sintaxe de curinga do Express 5, usado pelo NestJS 12.
    consumer.apply(CorrelationIdMiddleware, AuthenticationMiddleware).forRoutes('{*splat}');
  }
}
