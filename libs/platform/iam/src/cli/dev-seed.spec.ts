import { AuditRegistry, AuditService } from '@erp/platform-audit';
import { startPostgresTestEnv, type PostgresTestEnv } from '@erp/platform-db/testing';
import { TenantDb } from '@erp/platform-tenancy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PermissionCatalog } from '../rbac/permission-catalog';
import { PermissionRepository } from '../rbac/permission-repository';
import { PermissionService } from '../rbac/permission-service';
import { PLATFORM_MODULE, PLATFORM_PERMISSIONS } from '../rbac/platform-permissions';
import { RoleService } from '../rbac/role-service';
import { ADMINISTRATOR_ROLE } from '../rbac/system-roles';
import { FakeIdentityProvider } from '../testing';
import { IdentitySyncService } from '../webhooks/identity-sync-service';
import { DevSeedUserNotFoundError, seedDevelopmentIdentity } from './dev-seed';

const EMAIL = 'e2e+clerk_test@example.com';

let env: PostgresTestEnv;
let identity: FakeIdentityProvider;
let sync: IdentitySyncService;
let roles: RoleService;

beforeAll(async () => {
  env = await startPostgresTestEnv();

  const tenantDb = new TenantDb(env.appPool);
  const permissions = new PermissionRepository();
  const catalog = new PermissionCatalog();
  catalog.register(PLATFORM_MODULE, PLATFORM_PERMISSIONS);
  const audit = new AuditService(tenantDb, new AuditRegistry());
  roles = new RoleService(
    tenantDb,
    permissions,
    new PermissionService(tenantDb, permissions),
    catalog,
    audit,
  );
  sync = new IdentitySyncService(env.appPool, env.platformPool, tenantDb, roles, audit);

  identity = new FakeIdentityProvider();
  identity.addUser({ externalId: 'user_e2e', email: EMAIL, name: 'Usuária E2E' });
  identity.addMembership('user_e2e', {
    externalId: 'orgmem_e2e',
    organization: { externalId: 'org_e2e', name: 'Organização E2E', slug: 'organizacao-e2e' },
    role: 'org:admin',
  });
});

afterAll(async () => {
  await env?.stop();
});

describe('F0-11 semeadura de desenvolvimento (pnpm cli dev:seed)', () => {
  it('copia usuário, organização e vínculo do provedor, com papéis semeados', async () => {
    const result = await seedDevelopmentIdentity(identity, sync, EMAIL);

    expect(result.externalUserId).toBe('user_e2e');
    expect(result.tenants).toEqual([
      expect.objectContaining({ externalId: 'org_e2e', slug: 'organizacao-e2e', created: true }),
    ]);

    const tenantId = result.tenants[0]?.id ?? '';
    const papeis = await roles.list(tenantId);
    expect(papeis).toHaveLength(6);

    const membership = await env.platformPool.query<{ id: string }>(
      "select id from platform.memberships where clerk_membership_id = 'orgmem_e2e'",
    );
    const administrador = papeis.find((papel) => papel.name === ADMINISTRATOR_ROLE);
    expect(await roles.listMembershipRoles(tenantId, membership.rows[0]?.id ?? '')).toEqual([
      administrador?.id,
    ]);
  });

  it('rodar de novo não duplica nada', async () => {
    const result = await seedDevelopmentIdentity(identity, sync, EMAIL);

    expect(result.tenants[0]?.created).toBe(false);
    const vinculos = await env.platformPool.query(
      'select id from platform.memberships where user_id = $1',
      [result.userId],
    );
    expect(vinculos.rowCount).toBe(1);
  });

  it('falha com mensagem clara quando o e-mail não existe no provedor', async () => {
    await expect(
      seedDevelopmentIdentity(identity, sync, 'ninguem@example.com'),
    ).rejects.toBeInstanceOf(DevSeedUserNotFoundError);
  });
});
