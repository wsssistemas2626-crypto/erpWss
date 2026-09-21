import { loadApiEnv } from '@erp/platform-config';
import { AuditRegistry, AuditService } from '@erp/platform-audit';
import { createDbPool } from '@erp/platform-db';
import {
  ClerkIdentityProvider,
  DevSeedUserNotFoundError,
  IdentitySyncService,
  PermissionCatalog,
  PermissionRepository,
  PermissionService,
  PLATFORM_MODULE,
  PLATFORM_PERMISSIONS,
  RoleService,
  seedDevelopmentIdentity,
} from '@erp/platform-iam';
import { TenantDb } from '@erp/platform-tenancy';

/**
 * Entrada do `pnpm cli <comando>`.
 *
 * Comandos de operação que não justificam subir a API inteira. Como `apps/api`, monta
 * serviços e não tem regra de negócio: o que cada comando faz mora na lib dona do assunto.
 *
 * Roda por `tsx` com o `tsconfig.cli.json` da raiz: é ele que traz, ao mesmo tempo, os
 * caminhos `@erp/*` e os decorators que as libs do Nest usam.
 */
const COMMANDS: Readonly<Record<string, () => Promise<void>>> = {
  'dev:seed': devSeed,
};

/**
 * Copia para o banco local o usuário de teste do provedor e as organizações dele (F0-11).
 *
 * Existe porque em desenvolvimento e no E2E o webhook não tem como chegar: sem isto, o
 * banco só se povoa quando alguém entra pela primeira vez.
 */
async function devSeed(): Promise<void> {
  const env = loadApiEnv();
  const email = requireEnv('E2E_CLERK_USER_EMAIL');

  const pool = createDbPool(env.DATABASE_URL_APP, { applicationName: 'erp-cli' });
  const platformPool = createDbPool(env.DATABASE_URL_PLATFORM, {
    applicationName: 'erp-cli-platform',
  });

  try {
    const tenantDb = new TenantDb(pool);
    const permissions = new PermissionRepository();
    const catalog = new PermissionCatalog();
    catalog.register(PLATFORM_MODULE, PLATFORM_PERMISSIONS);
    const audit = new AuditService(tenantDb, new AuditRegistry());
    const roles = new RoleService(
      tenantDb,
      permissions,
      new PermissionService(tenantDb, permissions),
      catalog,
      audit,
    );
    const sync = new IdentitySyncService(pool, platformPool, tenantDb, roles, audit);

    const identity = new ClerkIdentityProvider({
      jwtKey: env.CLERK_JWT_KEY,
      secretKey: env.CLERK_SECRET_KEY,
      authorizedParties: env.CLERK_AUTHORIZED_PARTIES,
      webhookSigningSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
    });

    const result = await seedDevelopmentIdentity(identity, sync, email).catch((error: unknown) => {
      // A causa mais comum é `CLERK_SECRET_KEY` de outra instância, ou ainda o placeholder
      // do `.env.example`. Sem isto a mensagem do SDK é só "Unauthorized".
      if (error instanceof DevSeedUserNotFoundError) {
        throw error;
      }
      throw new Error(
        `Falha ao consultar o provedor de identidade (confira CLERK_SECRET_KEY no .env): ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    });

    console.error(`usuário ${email} provisionado (${result.userId})`);
    if (result.tenants.length === 0) {
      console.error(
        'nenhuma organização: convide o usuário para uma organização de teste no provedor',
      );
    }
    for (const tenant of result.tenants) {
      console.error(
        `organização ${tenant.slug} ${tenant.created ? 'criada' : 'já existia'} (${tenant.id}), papel no provedor: ${tenant.role}`,
      );
    }
  } finally {
    await Promise.all([pool.end(), platformPool.end()]);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(
      `A variável ${name} não está definida. Copie o .env.example para .env na raiz do repositório.`,
    );
  }
  return value;
}

async function main(): Promise<void> {
  const name = process.argv[2];
  const command = name === undefined ? undefined : COMMANDS[name];
  if (command === undefined) {
    throw new Error(
      `Comando desconhecido: ${name ?? '(nenhum)'}. Disponíveis: ${Object.keys(COMMANDS).join(', ')}.`,
    );
  }
  await command();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
