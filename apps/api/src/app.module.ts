import type { ApiEnv } from '@erp/platform-config';
import {
  AUDIT_PERMISSIONS,
  AUDIT_REGISTRY,
  AUDIT_TENANT_RESOLVER,
  AuditController,
  AuditRegistry,
  AuditService,
  type AuditTenantResolver,
} from '@erp/platform-audit';
import { createDbPool } from '@erp/platform-db';
import { CorrelationIdMiddleware } from '@erp/platform-http';
import { requireAuthContext } from '@erp/platform-iam';
import {
  AuthGuard,
  AuthenticationMiddleware,
  ClerkIdentityProvider,
  IDENTITY_PROVIDER,
  IdentityRepository,
  MeController,
  PERMISSION_CATALOG,
  PLATFORM_MODULE,
  PLATFORM_PERMISSIONS,
  PermissionCatalog,
  PermissionGuard,
  PermissionRepository,
  PermissionService,
  RoleService,
  RolesController,
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
      controllers: [HealthController, MeController, RolesController, AuditController],
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
        {
          provide: PERMISSION_CATALOG,
          useFactory: (): PermissionCatalog => {
            const catalog = new PermissionCatalog();
            catalog.register(PLATFORM_MODULE, [...PLATFORM_PERMISSIONS, ...AUDIT_PERMISSIONS]);
            // Cada módulo de negócio registra as suas aqui, a partir da Fase 1.
            return catalog;
          },
        },
        {
          provide: PermissionRepository,
          useFactory: (): PermissionRepository => new PermissionRepository(),
        },
        {
          provide: PermissionService,
          useFactory: (tenantDb: TenantDb, repository: PermissionRepository): PermissionService =>
            new PermissionService(tenantDb, repository),
          inject: [TenantDb, PermissionRepository],
        },
        {
          provide: AUDIT_REGISTRY,
          useFactory: (): AuditRegistry => {
            const registry = new AuditRegistry();
            // Cada módulo declara aqui os campos PII das suas entidades (RNF020).
            registry.register([]);
            return registry;
          },
        },
        {
          provide: AuditService,
          useFactory: (tenantDb: TenantDb, registry: AuditRegistry): AuditService =>
            new AuditService(tenantDb, registry),
          inject: [TenantDb, AUDIT_REGISTRY],
        },
        {
          // O IAM conhece o AuthContext; a lib de auditoria, não. A composição liga os dois.
          provide: AUDIT_TENANT_RESOLVER,
          useValue: {
            currentTenantId: () => {
              const auth = requireAuthContext();
              if (auth.tenant === undefined) {
                throw new Error('Consulta de auditoria sem tenant no contexto.');
              }
              return auth.tenant.id;
            },
          } satisfies AuditTenantResolver,
        },
        {
          provide: RoleService,
          useFactory: (
            tenantDb: TenantDb,
            repository: PermissionRepository,
            permissions: PermissionService,
            catalog: PermissionCatalog,
            audit: AuditService,
          ): RoleService => new RoleService(tenantDb, repository, permissions, catalog, audit),
          inject: [
            TenantDb,
            PermissionRepository,
            PermissionService,
            PERMISSION_CATALOG,
            AuditService,
          ],
        },
        // A ordem é a da execução: autenticar antes de autorizar.
        // Nega por padrão: rota sem @Public exige token válido (ADR-004).
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
        DbPoolLifecycle,
      ],
      exports: [
        DB_POOL,
        TenantDb,
        API_ENV,
        IDENTITY_PROVIDER,
        IdentityRepository,
        PERMISSION_CATALOG,
        PermissionService,
        RoleService,
        AuditService,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    // A ordem importa: a correlação precisa existir antes de qualquer log da autenticação.
    // `{*splat}` é a sintaxe de curinga do Express 5, usado pelo NestJS 12.
    consumer.apply(CorrelationIdMiddleware, AuthenticationMiddleware).forRoutes('{*splat}');
  }
}
