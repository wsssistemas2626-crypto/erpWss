import { startPostgresTestEnv, type PostgresTestEnv } from '@erp/platform-db/testing';
import { ProblemDetailsFilter, Public } from '@erp/platform-http';
import { createLogger } from '@erp/platform-observability';
import { TenantDb, requireTenantId } from '@erp/platform-tenancy';
import { withTenantSession } from '@erp/platform-tenancy/testing';
import { newId, type EntityId } from '@erp/shared-kernel';
import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AUTH_INVALID_TOKEN,
  AUTH_USER_NOT_PROVISIONED,
  IAM_ERROR_STATUS,
  TENANT_ACCESS_REVOKED,
  TENANT_INACTIVE,
  TENANT_NOT_SELECTED,
} from './errors';
import { AuthGuard } from './http/auth.guard';
import { AuthenticationMiddleware } from './http/authentication.middleware';
import { MeController } from './http/me.controller';

import { IDENTITY_PROVIDER } from './identity-provider';
import { IdentityRepository } from './infra/identity-repository';
import { FakeIdentityProvider } from './testing';

/** Rota de negócio: exige token, organização ativa e vínculo ativo. */
@Controller('projects')
class BusinessController {
  @Get()
  list(): { tenantId: EntityId } {
    // Prova que o TenantContext chegou ao handler com o tenant_id local.
    return { tenantId: requireTenantId() };
  }
}

@Controller('ping')
class PublicController {
  @Get()
  @Public()
  ping(): { pong: true } {
    return { pong: true };
  }
}

const identity = new FakeIdentityProvider();

const TENANT_ATIVO = { id: newId(), org: 'org_ativa', slug: 'ativa' };
const TENANT_SUSPENSO = { id: newId(), org: 'org_suspensa', slug: 'suspensa' };
const USUARIO = { id: newId(), external: 'user_1', email: 'pessoa@example.com', name: 'Pessoa' };
const USUARIO_REVOGADO = {
  id: newId(),
  external: 'user_revogado',
  email: 'ex@example.com',
  name: 'Ex',
};

let env: PostgresTestEnv;
let app: INestApplication;
let baseUrl: string;

const discard = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

@Module({
  controllers: [MeController, BusinessController, PublicController],
  providers: [
    { provide: IDENTITY_PROVIDER, useValue: identity },
    {
      provide: IdentityRepository,
      useFactory: () => new IdentityRepository(env.appPool, new TenantDb(env.appPool)),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
class TestModule {
  configure(consumer: { apply: (m: unknown) => { forRoutes: (r: string) => void } }): void {
    consumer.apply(AuthenticationMiddleware).forRoutes('{*splat}');
  }
}

beforeAll(async () => {
  env = await startPostgresTestEnv();

  await env.ownerPool.query(
    `insert into platform.tenants (id, clerk_org_id, name, slug, status)
     values ($1, $2, 'Ativa', $3, 'ACTIVE'), ($4, $5, 'Suspensa', $6, 'SUSPENDED')`,
    [
      TENANT_ATIVO.id,
      TENANT_ATIVO.org,
      TENANT_ATIVO.slug,
      TENANT_SUSPENSO.id,
      TENANT_SUSPENSO.org,
      TENANT_SUSPENSO.slug,
    ],
  );

  for (const user of [USUARIO, USUARIO_REVOGADO]) {
    await env.ownerPool.query(
      'insert into platform.users (id, clerk_user_id, email, name) values ($1, $2, $3, $4)',
      [user.id, user.external, user.email, user.name],
    );
  }

  // memberships tem RLS forçada: até o fixture precisa declarar o tenant.
  await withTenantSession(env.ownerPool, TENANT_ATIVO.id, async (client) => {
    await client.query(
      `insert into platform.memberships (id, tenant_id, user_id, clerk_membership_id, status)
       values ($1, $2, $3, 'orgmem_1', 'ACTIVE'), ($4, $5, $6, 'orgmem_2', 'REVOKED')`,
      [newId(), TENANT_ATIVO.id, USUARIO.id, newId(), TENANT_ATIVO.id, USUARIO_REVOGADO.id],
    );
  });
  await withTenantSession(env.ownerPool, TENANT_SUSPENSO.id, async (client) => {
    await client.query(
      `insert into platform.memberships (id, tenant_id, user_id, clerk_membership_id, status)
       values ($1, $2, $3, 'orgmem_3', 'ACTIVE')`,
      [newId(), TENANT_SUSPENSO.id, USUARIO.id],
    );
  });

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

async function get(
  path: string,
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe('F0-07 token válido com organização ativa', () => {
  it('GET /me devolve o usuário e o tenant ativo', async () => {
    const token = identity.createSessionToken({
      externalUserId: USUARIO.external,
      externalOrganizationId: TENANT_ATIVO.org,
      organizationSlug: TENANT_ATIVO.slug,
    });

    const response = await get('/me', token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { id: USUARIO.id, email: USUARIO.email, name: USUARIO.name },
      tenant: {
        id: TENANT_ATIVO.id,
        name: 'Ativa',
        slug: TENANT_ATIVO.slug,
        status: 'ACTIVE',
      },
      membershipStatus: 'ACTIVE',
    });
  });

  it('o TenantContext da requisição carrega o tenant_id local, não o id do Clerk', async () => {
    const token = identity.createSessionToken({
      externalUserId: USUARIO.external,
      externalOrganizationId: TENANT_ATIVO.org,
    });

    const response = await get('/projects', token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ tenantId: TENANT_ATIVO.id });
  });
});

describe('F0-07 token sem organização ativa', () => {
  it('rota de negócio recusa com TENANT_NOT_SELECTED', async () => {
    const token = identity.createSessionToken({ externalUserId: USUARIO.external });

    const response = await get('/projects', token);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(TENANT_NOT_SELECTED);
  });

  it('GET /me continua respondendo 200, com tenant nulo', async () => {
    const token = identity.createSessionToken({ externalUserId: USUARIO.external });

    const response = await get('/me', token);

    expect(response.status).toBe(200);
    expect(response.body.tenant).toBeNull();
    expect(response.body.membershipStatus).toBeNull();
  });
});

describe('F0-07 token inválido', () => {
  it('recusa token expirado', async () => {
    const token = identity.createSessionToken({
      externalUserId: USUARIO.external,
      expiresInSeconds: -60,
      notBeforeInSeconds: -120,
    });

    const response = await get('/me', token);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(AUTH_INVALID_TOKEN);
  });

  it('recusa token assinado por outra chave', async () => {
    const token = identity.createTokenSignedByStranger({ externalUserId: USUARIO.external });

    const response = await get('/me', token);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(AUTH_INVALID_TOKEN);
  });

  it('recusa token com azp não autorizado', async () => {
    const token = identity.createSessionToken({
      externalUserId: USUARIO.external,
      azp: 'https://site-de-terceiro.example',
    });

    const response = await get('/me', token);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(AUTH_INVALID_TOKEN);
  });

  it('recusa token que ainda não entrou em vigor', async () => {
    const token = identity.createSessionToken({
      externalUserId: USUARIO.external,
      notBeforeInSeconds: 600,
    });

    const response = await get('/me', token);

    expect(response.status).toBe(401);
  });

  it('recusa requisição sem token', async () => {
    const response = await get('/me');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(AUTH_INVALID_TOKEN);
  });

  it('recusa usuário válido no provedor mas ainda não provisionado aqui', async () => {
    const token = identity.createSessionToken({ externalUserId: 'user_desconhecido' });

    const response = await get('/me', token);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(AUTH_USER_NOT_PROVISIONED);
  });
});

describe('F0-07 membership revogado', () => {
  it('recusa com TENANT_ACCESS_REVOKED', async () => {
    const token = identity.createSessionToken({
      externalUserId: USUARIO_REVOGADO.external,
      externalOrganizationId: TENANT_ATIVO.org,
    });

    const response = await get('/projects', token);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(TENANT_ACCESS_REVOKED);
  });
});

describe('F0-07 tenant suspenso', () => {
  it('recusa qualquer membro com TENANT_INACTIVE', async () => {
    const token = identity.createSessionToken({
      externalUserId: USUARIO.external,
      externalOrganizationId: TENANT_SUSPENSO.org,
    });

    const response = await get('/projects', token);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(TENANT_INACTIVE);
  });
});

describe('F0-07 rota pública', () => {
  it('responde sem token', async () => {
    const response = await get('/ping');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ pong: true });
  });
});
