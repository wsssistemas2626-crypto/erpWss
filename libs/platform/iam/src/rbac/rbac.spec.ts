import { startPostgresTestEnv, type PostgresTestEnv } from '@erp/platform-db/testing';
import { ProblemDetailsFilter } from '@erp/platform-http';
import { createLogger } from '@erp/platform-observability';
import { TenantDb } from '@erp/platform-tenancy';
import { withTenantSession } from '@erp/platform-tenancy/testing';
import { CONCURRENCY_CONFLICT, ENTITY_NOT_FOUND, newId, type EntityId } from '@erp/shared-kernel';
import { Module, type INestApplication } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_FORBIDDEN, IAM_ERROR_STATUS } from '../errors';
import { AuthGuard } from '../http/auth.guard';
import { AuthenticationMiddleware } from '../http/authentication.middleware';
import { PermissionGuard } from '../http/permission.guard';
import { RolesController } from '../http/roles.controller';
import { IDENTITY_PROVIDER } from '../identity-provider';
import { IdentityRepository } from '../infra/identity-repository';
import { FakeIdentityProvider } from '../testing';
import { PermissionCatalog } from './permission-catalog';
import { PermissionRepository } from './permission-repository';
import { PermissionService } from './permission-service';
import { PLATFORM_MODULE, PLATFORM_PERMISSIONS } from './platform-permissions';
import { RoleService } from './role-service';
import { ADMINISTRATOR_ROLE } from './system-roles';

const identity = new FakeIdentityProvider();

const TENANT = { id: newId(), org: 'org_rbac', slug: 'rbac' };
const ADMIN = { id: newId(), external: 'user_admin', membershipId: newId() };
const LEITOR = { id: newId(), external: 'user_leitor', membershipId: newId() };

let env: PostgresTestEnv;
let app: INestApplication;
let baseUrl: string;
let roleService: RoleService;
let permissionService: PermissionService;

const discard = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

@Module({
  controllers: [RolesController],
  providers: [
    { provide: IDENTITY_PROVIDER, useValue: identity },
    {
      provide: IdentityRepository,
      useFactory: () => new IdentityRepository(env.appPool, new TenantDb(env.appPool)),
    },
    { provide: PermissionService, useFactory: () => permissionService },
    { provide: RoleService, useFactory: () => roleService },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
class TestModule {
  configure(consumer: { apply: (m: unknown) => { forRoutes: (r: string) => void } }): void {
    consumer.apply(AuthenticationMiddleware).forRoutes('{*splat}');
  }
}

beforeAll(async () => {
  env = await startPostgresTestEnv();

  const catalog = new PermissionCatalog();
  catalog.register(PLATFORM_MODULE, PLATFORM_PERMISSIONS);
  const repository = new PermissionRepository(new TenantDb(env.appPool));
  permissionService = new PermissionService(repository);
  roleService = new RoleService(repository, permissionService, catalog);

  await env.ownerPool.query(
    `insert into platform.tenants (id, clerk_org_id, name, slug) values ($1, $2, 'RBAC', $3)`,
    [TENANT.id, TENANT.org, TENANT.slug],
  );
  for (const [user, name] of [
    [ADMIN, 'Admin'],
    [LEITOR, 'Leitor'],
  ] as const) {
    await env.ownerPool.query(
      'insert into platform.users (id, clerk_user_id, email, name) values ($1, $2, $3, $4)',
      [user.id, user.external, `${user.external}@example.com`, name],
    );
  }
  await withTenantSession(env.ownerPool, TENANT.id, async (client) => {
    await client.query(
      `insert into platform.memberships (id, tenant_id, user_id, clerk_membership_id)
       values ($1, $2, $3, 'orgmem_admin'), ($4, $5, $6, 'orgmem_leitor')`,
      [ADMIN.membershipId, TENANT.id, ADMIN.id, LEITOR.membershipId, TENANT.id, LEITOR.id],
    );
  });

  await roleService.seedSystemRoles(TENANT.id);

  const administrador = await roleService.findSystemRoleByName(TENANT.id, ADMINISTRATOR_ROLE);
  const leitor = await roleService.findSystemRoleByName(TENANT.id, 'Leitor');
  await roleService.assignRoles(TENANT.id, ADMIN.membershipId, { roleIds: [administrador ?? ''] });
  await roleService.assignRoles(TENANT.id, LEITOR.membershipId, { roleIds: [leitor ?? ''] });

  app = await NestFactory.create(TestModule, { logger: false });
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

function tokenFor(user: { external: string }): string {
  return identity.createSessionToken({
    externalUserId: user.external,
    externalOrganizationId: TENANT.org,
  });
}

async function call(
  method: string,
  path: string,
  user: { external: string },
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${tokenFor(user)}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text === '' ? {} : (JSON.parse(text) as Record<string, unknown>),
  };
}

describe('F0-08 endpoint sem permissão', () => {
  it('Leitor recebe 403 AUTH_FORBIDDEN ao tentar criar papel', async () => {
    const response = await call('POST', '/roles', LEITOR, { name: 'Novo', permissions: [] });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(AUTH_FORBIDDEN);
  });

  it('Leitor também não lista papéis, que exige platform.role.read', async () => {
    const response = await call('GET', '/roles', LEITOR);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(AUTH_FORBIDDEN);
  });

  it('Administrador passa nas mesmas rotas', async () => {
    const response = await call('GET', '/roles', ADMIN);

    expect(response.status).toBe(200);
  });
});

describe('F0-08 papéis semeados', () => {
  it('cria os seis papéis do sistema, com Administrador recebendo tudo', async () => {
    const response = await call('GET', '/roles', ADMIN);
    const items = response.body.items as readonly {
      name: string;
      isSystem: boolean;
      permissions: string[];
    }[];

    expect(items.map((role) => role.name)).toEqual([
      'Administrador',
      'Financeiro',
      'Gerente de Projetos',
      'Gestor de Portfólio',
      'Leitor',
      'Membro de Equipe',
    ]);
    expect(items.every((role) => role.isSystem)).toBe(true);
    expect(items.find((role) => role.name === 'Administrador')?.permissions).toEqual(
      PLATFORM_PERMISSIONS.map((permission) => permission.key).sort(),
    );
  });

  it('semear de novo é idempotente', async () => {
    await roleService.seedSystemRoles(TENANT.id);
    const response = await call('GET', '/roles', ADMIN);

    expect(response.body.total).toBe(6);
  });
});

describe('F0-08 CRUD de papéis', () => {
  let criadoId: EntityId;

  it('cria papel com permissões do catálogo', async () => {
    const response = await call('POST', '/roles', ADMIN, {
      name: 'Auditor',
      description: 'Só enxerga papéis',
      permissions: ['platform.role.read'],
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Auditor',
      isSystem: false,
      version: 1,
      permissions: ['platform.role.read'],
    });
    criadoId = response.body.id as EntityId;
  });

  it('recusa permissão fora do catálogo', async () => {
    const response = await call('POST', '/roles', ADMIN, {
      name: 'Inventado',
      permissions: ['projects.inexistente.acao'],
    });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('PERMISSION_UNKNOWN');
  });

  it('altera exigindo a versão corrente', async () => {
    const response = await call('PUT', `/roles/${criadoId}`, ADMIN, {
      version: 1,
      permissions: ['platform.role.read', 'platform.membership.read'],
    });

    expect(response.status).toBe(200);
    expect(response.body.version).toBe(2);
    expect(response.body.permissions).toEqual(['platform.membership.read', 'platform.role.read']);
  });

  it('versão divergente vira 409', async () => {
    const response = await call('PUT', `/roles/${criadoId}`, ADMIN, {
      version: 1,
      name: 'Auditor Revisado',
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe(CONCURRENCY_CONFLICT);
  });

  it('papel do sistema não pode ser excluído', async () => {
    const lista = await call('GET', '/roles', ADMIN);
    const items = lista.body.items as readonly { id: string; name: string }[];
    const administrador = items.find((role) => role.name === ADMINISTRATOR_ROLE);

    const response = await call('DELETE', `/roles/${administrador?.id ?? ''}`, ADMIN);

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('ROLE_IS_SYSTEM');
  });

  it('papel comum é excluído', async () => {
    const response = await call('DELETE', `/roles/${criadoId}`, ADMIN);

    expect(response.status).toBe(204);
    expect((await call('GET', `/roles`, ADMIN)).body.total).toBe(6);
  });

  it('papel inexistente vira 404', async () => {
    const response = await call('PUT', `/roles/${newId()}`, ADMIN, { version: 1 });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ENTITY_NOT_FOUND);
  });
});

describe('F0-08 atribuição de papéis invalida o cache na hora', () => {
  it('dar Administrador ao Leitor libera o acesso sem esperar o TTL', async () => {
    const negado = await call('GET', '/roles', LEITOR);
    expect(negado.status).toBe(403);

    const administrador = await roleService.findSystemRoleByName(TENANT.id, ADMINISTRATOR_ROLE);
    await roleService.assignRoles(TENANT.id, LEITOR.membershipId, {
      roleIds: [administrador ?? ''],
    });

    const liberado = await call('GET', '/roles', LEITOR);
    expect(liberado.status).toBe(200);

    const leitor = await roleService.findSystemRoleByName(TENANT.id, 'Leitor');
    await roleService.assignRoles(TENANT.id, LEITOR.membershipId, { roleIds: [leitor ?? ''] });
    expect((await call('GET', '/roles', LEITOR)).status).toBe(403);
  });

  it('atribuir papel inexistente vira 404', async () => {
    const response = await call('PUT', `/memberships/${LEITOR.membershipId}/roles`, ADMIN, {
      roleIds: [newId()],
    });

    expect(response.status).toBe(404);
  });
});
