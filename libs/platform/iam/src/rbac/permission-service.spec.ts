import { newId } from '@erp/shared-kernel';
import { describe, expect, it } from 'vitest';
import { PERMISSION_CACHE_TTL_MS, PermissionService } from './permission-service';
import type { PermissionRepository } from './permission-repository';
import type { TenantDb } from '@erp/platform-tenancy';

const TENANT = newId();
const MEMBERSHIP = newId();

/** Repositório e transação de mentira: só contam quantas vezes o banco seria consultado. */
function fakeRepository(permissions: string[]) {
  const state = { calls: 0, permissions };
  const repository = {
    findPermissionsByMembership: () => {
      state.calls += 1;
      return Promise.resolve(state.permissions);
    },
  } as unknown as PermissionRepository;
  const tenantDb = {
    withTenantTx: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
  } as unknown as TenantDb;
  return { repository, tenantDb, state };
}

describe('F0-08 cache de permissões', () => {
  it('consulta o banco uma vez e reaproveita dentro dos 60 s', async () => {
    const { repository, tenantDb, state } = fakeRepository(['platform.role.read']);
    const service = new PermissionService(tenantDb, repository);

    await service.permissionsOf(TENANT, MEMBERSHIP);
    await service.permissionsOf(TENANT, MEMBERSHIP);

    expect(state.calls).toBe(1);
  });

  it('recarrega depois do TTL', async () => {
    const { repository, tenantDb, state } = fakeRepository(['platform.role.read']);
    let agora = 0;
    const service = new PermissionService(tenantDb, repository, () => agora);

    await service.permissionsOf(TENANT, MEMBERSHIP);
    agora += PERMISSION_CACHE_TTL_MS + 1;
    await service.permissionsOf(TENANT, MEMBERSHIP);

    expect(state.calls).toBe(2);
  });

  it('invalidar o tenant descarta o cache na hora', async () => {
    const { repository, tenantDb, state } = fakeRepository(['platform.role.read']);
    const service = new PermissionService(tenantDb, repository);

    await service.permissionsOf(TENANT, MEMBERSHIP);
    service.invalidateTenant(TENANT);
    await service.permissionsOf(TENANT, MEMBERSHIP);

    expect(state.calls).toBe(2);
  });

  it('invalidar um tenant não mexe no cache de outro', async () => {
    const { repository, tenantDb, state } = fakeRepository(['platform.role.read']);
    const service = new PermissionService(tenantDb, repository);
    const outroTenant = newId();

    await service.permissionsOf(TENANT, MEMBERSHIP);
    await service.permissionsOf(outroTenant, MEMBERSHIP);
    service.invalidateTenant(outroTenant);
    await service.permissionsOf(TENANT, MEMBERSHIP);

    expect(state.calls).toBe(2);
  });

  it('has responde pela permissão exata', async () => {
    const { repository, tenantDb } = fakeRepository(['platform.role.read']);
    const service = new PermissionService(tenantDb, repository);

    expect(await service.has(TENANT, MEMBERSHIP, 'platform.role.read')).toBe(true);
    expect(await service.has(TENANT, MEMBERSHIP, 'platform.role.create')).toBe(false);
  });
});
