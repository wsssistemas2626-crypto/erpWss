import { AuditRegistry, AuditService } from '@erp/platform-audit';
import { ModuleCatalog, TenantModuleService } from '@erp/platform-config';
import { startPostgresTestEnv, type PostgresTestEnv } from '@erp/platform-db/testing';
import { ProblemDetailsFilter } from '@erp/platform-http';
import { createLogger } from '@erp/platform-observability';
import { TenantDb } from '@erp/platform-tenancy';
import { newId } from '@erp/shared-kernel';
import { Module, type INestApplication } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IAM_ERROR_STATUS } from '../errors';
import { AuthGuard } from '../http/auth.guard';
import { AuthenticationMiddleware } from '../http/authentication.middleware';
import { MeController } from '../http/me.controller';
import { PermissionGuard } from '../http/permission.guard';
import { IDENTITY_PROVIDER } from '../identity-provider';
import { IdentityRepository } from '../infra/identity-repository';
import { PermissionCatalog } from '../rbac/permission-catalog';
import { PermissionRepository } from '../rbac/permission-repository';
import { PermissionService } from '../rbac/permission-service';
import { PLATFORM_MODULE, PLATFORM_PERMISSIONS } from '../rbac/platform-permissions';
import { RoleService } from '../rbac/role-service';
import { ADMINISTRATOR_ROLE } from '../rbac/system-roles';
import { FakeIdentityProvider } from '../testing';
import { DEFAULT_MEMBER_ROLE, IdentitySyncService } from './identity-sync-service';
import { DB_POOL_FOR_WEBHOOKS } from './tokens';
import { ClerkWebhookController } from './webhook.controller';

const identity = new FakeIdentityProvider();

let env: PostgresTestEnv;
let app: INestApplication;
let baseUrl: string;
let sync: IdentitySyncService;
let roles: RoleService;
let audit: AuditService;

const discard = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

@Module({
  controllers: [ClerkWebhookController, MeController],
  providers: [
    { provide: IDENTITY_PROVIDER, useValue: identity },
    { provide: IdentitySyncService, useFactory: () => sync },
    { provide: DB_POOL_FOR_WEBHOOKS, useFactory: () => env.appPool },
    {
      provide: IdentityRepository,
      useFactory: () => new IdentityRepository(env.appPool, new TenantDb(env.appPool)),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: PermissionService, useFactory: () => permissionService },
    { provide: TenantModuleService, useFactory: () => tenantModuleService },
  ],
})
class TestModule {
  configure(consumer: { apply: (m: unknown) => { forRoutes: (r: string) => void } }): void {
    consumer.apply(AuthenticationMiddleware).forRoutes('{*splat}');
  }
}

let permissionService: PermissionService;
let tenantModuleService: TenantModuleService;

beforeAll(async () => {
  env = await startPostgresTestEnv();

  const tenantDb = new TenantDb(env.appPool);
  const repository = new PermissionRepository();
  permissionService = new PermissionService(tenantDb, repository);
  const catalog = new PermissionCatalog();
  catalog.register(PLATFORM_MODULE, PLATFORM_PERMISSIONS);
  const modules = new ModuleCatalog();
  modules.register([{ key: PLATFORM_MODULE, description: 'Administração da plataforma' }]);
  audit = new AuditService(tenantDb, new AuditRegistry());
  tenantModuleService = new TenantModuleService(tenantDb, modules, audit);
  roles = new RoleService(tenantDb, repository, permissionService, catalog, audit);
  sync = new IdentitySyncService(env.appPool, env.platformPool, tenantDb, roles, audit);

  app = await NestFactory.create(TestModule, { logger: false, rawBody: true });
  app.useGlobalFilters(
    new ProblemDetailsFilter(createLogger({ name: 'test', level: 'fatal', destination: discard }), {
      statusByCode: IAM_ERROR_STATUS,
    }),
  );
  await app.listen(0);
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  await env?.stop();
});

async function postWebhook(
  event: { type: string; data: Record<string, unknown> },
  options: { svixId?: string; corromperAssinatura?: boolean } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = JSON.stringify(event);
  const headers = identity.signWebhook(payload, options.svixId ? { svixId: options.svixId } : {});
  if (options.corromperAssinatura === true) {
    headers['svix-signature'] = 'v1,YXNzaW5hdHVyYS1pbnZhbGlkYQ==';
  }

  const response = await fetch(`${baseUrl}/webhooks/clerk`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: payload,
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function userEvent(type: string, id: string, email: string) {
  return {
    type,
    data: {
      id,
      email_addresses: [{ id: 'idn_1', email_address: email }],
      primary_email_address_id: 'idn_1',
      first_name: 'Ana',
      last_name: 'Souza',
    },
  };
}

describe('F0-11 organização criada no Clerk', () => {
  it('cria o tenant com clerk_org_id, status ACTIVE e papéis semeados', async () => {
    const response = await postWebhook({
      type: 'organization.created',
      data: { id: 'org_B', name: 'Empresa B', slug: 'empresa-b' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, outcome: 'applied' });

    const tenant = await env.appPool.query<{ id: string; status: string }>(
      "select id, status from platform.tenants where clerk_org_id = 'org_B'",
    );
    expect(tenant.rows[0]?.status).toBe('ACTIVE');

    const papeis = await roles.list(tenant.rows[0]?.id ?? '');
    expect(papeis.map((papel) => papel.name)).toContain(ADMINISTRATOR_ROLE);
    expect(papeis).toHaveLength(6);
  });
});

describe('F0-11 assinatura inválida', () => {
  it('responde 400 e não grava nada', async () => {
    const response = await postWebhook(
      { type: 'organization.created', data: { id: 'org_INVALIDA', name: 'X', slug: 'x' } },
      { corromperAssinatura: true },
    );

    expect(response.status).toBe(400);
    const tenant = await env.appPool.query(
      "select id from platform.tenants where clerk_org_id = 'org_INVALIDA'",
    );
    expect(tenant.rowCount).toBe(0);
  });
});

describe('F0-11 webhook repetido', () => {
  it('o mesmo svix-id responde 200 sem duplicar o usuário', async () => {
    const svixId = `msg_${newId()}`;
    const evento = userEvent('user.created', 'user_dup', 'dup@example.com');

    const primeira = await postWebhook(evento, { svixId });
    const segunda = await postWebhook(evento, { svixId });

    expect(primeira.body.outcome).toBe('applied');
    expect(segunda.status).toBe(200);
    expect(segunda.body.outcome).toBe('duplicated');

    const usuarios = await env.appPool.query(
      "select id from platform.users where clerk_user_id = 'user_dup'",
    );
    expect(usuarios.rowCount).toBe(1);
  });
});

describe('F0-11 membro removido', () => {
  it('o vínculo local fica REVOKED', async () => {
    await postWebhook({
      type: 'organization.created',
      data: { id: 'org_M', name: 'M', slug: 'm' },
    });
    await postWebhook(userEvent('user.created', 'user_m', 'm@example.com'));
    await postWebhook({
      type: 'organizationMembership.created',
      data: {
        id: 'orgmem_m',
        organization: { id: 'org_M' },
        public_user_data: { user_id: 'user_m' },
        role: 'org:member',
      },
    });

    const resposta = await postWebhook({
      type: 'organizationMembership.deleted',
      data: { id: 'orgmem_m' },
    });

    expect(resposta.status).toBe(200);
    const vinculo = await env.platformPool.query<{ id: string; status: string; tenant_id: string }>(
      `select m.id, m.status, m.tenant_id from platform.memberships m
         join platform.tenants t on t.id = m.tenant_id
        where m.clerk_membership_id = 'orgmem_m' and t.clerk_org_id = 'org_M'`,
    );
    expect(vinculo.rows[0]?.status).toBe('REVOKED');

    const trilha = await audit.findByEntity(vinculo.rows[0]?.tenant_id ?? '', {
      entity: 'membership',
      entityId: vinculo.rows[0]?.id ?? '',
      offset: 0,
      limit: 10,
    });
    expect(trilha.items[0]).toMatchObject({
      action: 'UPDATE',
      before: { status: 'ACTIVE' },
      after: { status: 'REVOKED' },
    });
  });

  it('membro comum entra como Membro de Equipe e admin como Administrador', async () => {
    await postWebhook(userEvent('user.created', 'user_admin_clerk', 'admin@example.com'));
    await postWebhook({
      type: 'organizationMembership.created',
      data: {
        id: 'orgmem_admin',
        organization: { id: 'org_M' },
        public_user_data: { user_id: 'user_admin_clerk' },
        role: 'org:admin',
      },
    });

    const tenant = await env.appPool.query<{ id: string }>(
      "select id from platform.tenants where clerk_org_id = 'org_M'",
    );
    const tenantId = tenant.rows[0]?.id ?? '';
    const papeis = await roles.list(tenantId);
    const administrador = papeis.find((papel) => papel.name === ADMINISTRATOR_ROLE);
    const membro = papeis.find((papel) => papel.name === DEFAULT_MEMBER_ROLE);

    const membership = await env.platformPool.query<{ id: string }>(
      "select id from platform.memberships where clerk_membership_id = 'orgmem_admin'",
    );
    const doAdmin = await roles.listMembershipRoles(tenantId, membership.rows[0]?.id ?? '');
    expect(doAdmin).toEqual([administrador?.id]);

    const comum = await env.platformPool.query<{ id: string }>(
      "select id from platform.memberships where clerk_membership_id = 'orgmem_m'",
    );
    const doComum = await roles.listMembershipRoles(tenantId, comum.rows[0]?.id ?? '');
    expect(doComum).toEqual([membro?.id]);
  });
});

describe('F0-11 usuário excluído no Clerk', () => {
  it('o usuário fica DELETED, os vínculos REVOKED, e a linha continua existindo', async () => {
    await postWebhook(userEvent('user.created', 'user_del', 'del@example.com'));
    await postWebhook({
      type: 'organizationMembership.created',
      data: {
        id: 'orgmem_del',
        organization: { id: 'org_M' },
        public_user_data: { user_id: 'user_del' },
        role: 'org:member',
      },
    });

    await postWebhook({ type: 'user.deleted', data: { id: 'user_del', deleted: true } });

    const usuario = await env.appPool.query<{ id: string; status: string }>(
      "select id, status from platform.users where clerk_user_id = 'user_del'",
    );
    expect(usuario.rows[0]?.status).toBe('DELETED');

    const vinculo = await env.platformPool.query<{ status: string }>(
      "select status from platform.memberships where clerk_membership_id = 'orgmem_del'",
    );
    expect(vinculo.rows[0]?.status).toBe('REVOKED');
  });
});

describe('F0-11 provisionamento sob demanda', () => {
  it('token válido de organização desconhecida cria tenant, usuário e vínculo', async () => {
    identity.addUser({ externalId: 'user_jit', email: 'jit@example.com', name: 'JIT' });
    identity.addOrganization({ externalId: 'org_C', name: 'Empresa C', slug: 'empresa-c' });

    const token = identity.createSessionToken({
      externalUserId: 'user_jit',
      externalOrganizationId: 'org_C',
      organizationRole: 'org:admin',
    });

    const response = await fetch(`${baseUrl}/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      user: { email: 'jit@example.com', name: 'JIT' },
      tenant: { slug: 'empresa-c', status: 'ACTIVE' },
      membershipStatus: 'ACTIVE',
    });

    const tenant = await env.appPool.query<{ id: string }>(
      "select id from platform.tenants where clerk_org_id = 'org_C'",
    );
    const papeis = await roles.list(tenant.rows[0]?.id ?? '');
    expect(papeis).toHaveLength(6);
  });

  it('o webhook que chega depois reconcilia o vínculo provisório', async () => {
    await postWebhook({
      type: 'organizationMembership.created',
      data: {
        id: 'orgmem_c_verdadeiro',
        organization: { id: 'org_C' },
        public_user_data: { user_id: 'user_jit' },
        role: 'org:admin',
      },
    });

    const vinculos = await env.platformPool.query<{ clerk_membership_id: string }>(
      `select m.clerk_membership_id from platform.memberships m
         join platform.tenants t on t.id = m.tenant_id
        where t.clerk_org_id = 'org_C'`,
    );

    expect(vinculos.rowCount).toBe(1);
    expect(vinculos.rows[0]?.clerk_membership_id).toBe('orgmem_c_verdadeiro');
  });
});

describe('F0-11 organização renomeada e encerrada no Clerk', () => {
  it('renomear deixa registro de auditoria com antes e depois', async () => {
    await postWebhook({
      type: 'organization.created',
      data: { id: 'org_R', name: 'Antiga', slug: 'antiga' },
    });
    await postWebhook({
      type: 'organization.updated',
      data: { id: 'org_R', name: 'Nova', slug: 'nova' },
    });

    const tenant = await env.appPool.query<{ id: string; name: string }>(
      "select id, name from platform.tenants where clerk_org_id = 'org_R'",
    );
    const tenantId = tenant.rows[0]?.id ?? '';
    expect(tenant.rows[0]?.name).toBe('Nova');

    const trilha = await audit.findByEntity(tenantId, {
      entity: 'tenant',
      entityId: tenantId,
      offset: 0,
      limit: 10,
    });
    expect(trilha.items[0]).toMatchObject({
      action: 'UPDATE',
      before: { name: 'Antiga' },
      after: { name: 'Nova' },
    });
  });

  it('organização excluída no Clerk deixa o tenant CANCELLED', async () => {
    await postWebhook({ type: 'organization.deleted', data: { id: 'org_R', deleted: true } });

    const tenant = await env.appPool.query<{ id: string; status: string }>(
      "select id, status from platform.tenants where clerk_org_id = 'org_R'",
    );
    expect(tenant.rows[0]?.status).toBe('CANCELLED');

    const trilha = await audit.findByEntity(tenant.rows[0]?.id ?? '', {
      entity: 'tenant',
      entityId: tenant.rows[0]?.id ?? '',
      offset: 0,
      limit: 10,
    });
    expect(trilha.items[0]).toMatchObject({ action: 'UPDATE', after: { status: 'CANCELLED' } });
  });
});

describe('F0-11 evento não tratado', () => {
  it('responde 200 e ignora, para o provedor parar de reentregar', async () => {
    const response = await postWebhook({ type: 'session.created', data: { id: 'sess_x' } });

    expect(response.status).toBe(200);
    expect(response.body.outcome).toBe('ignored');
  });
});
