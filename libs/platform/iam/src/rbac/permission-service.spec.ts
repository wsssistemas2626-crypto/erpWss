import { newId } from '@erp/shared-kernel';
import { describe, expect, it } from 'vitest';
import { PERMISSION_CACHE_TTL_MS, PermissionService } from './permission-service';
import type { PermissionRepository } from './permission-repository';

const TENANT = newId();
const MEMBERSHIP = newId();

/** Repositório de mentira: só conta quantas vezes foi consultado. */
function fakeRepository(permissions: string[]) {
  const state = { calls: 0, permissions };
  const repository = {
    findPermissionsByMembership: () => {
      state.calls += 1;
      return Promise.resolve(state.permissions);
    },
  } as unknown as PermissionRepository;
  return { repository, state };
}

describe('F0-08 cache de permissões', () => {
  it('consulta o banco uma vez e reaproveita dentro dos 60 s', async () => {
    const { repository, state } = fakeRepository(['platform.role.read']);
    const service = new PermissionService(repository);

    await service.permissionsOf(TENANT, MEMBERSHIP);
    await service.permissionsOf(TENANT, MEMBERSHIP);

    expect(state.calls).toBe(1);
  });

  it('recarrega depois do TTL', async () => {
    const { repository, state } = fakeRepository(['platform.role.read']);
    let agora = 0;
    const service = new PermissionService(repository, () => agora);

    await service.permissionsOf(TENANT, MEMBERSHIP);
    agora += PERMISSION_CACHE_TTL_MS + 1;
    await service.permissionsOf(TENANT, MEMBERSHIP);

    expect(state.calls).toBe(2);
  });

  it('invalidar o tenant descarta o cache na hora', async () => {
    const { repository, state } = fakeRepository(['platform.role.read']);
    const service = new PermissionService(repository);

    await service.permissionsOf(TENANT, MEMBERSHIP);
    service.invalidateTenant(TENANT);
    await service.permissionsOf(TENANT, MEMBERSHIP);

    expect(state.calls).toBe(2);
  });

  it('invalidar um tenant não mexe no cache de outro', async () => {
    const { repository, state } = fakeRepository(['platform.role.read']);
    const service = new PermissionService(repository);
    const outroTenant = newId();

    await service.permissionsOf(TENANT, MEMBERSHIP);
    await service.permissionsOf(outroTenant, MEMBERSHIP);
    service.invalidateTenant(outroTenant);
    await service.permissionsOf(TENANT, MEMBERSHIP);

    expect(state.calls).toBe(2);
  });

  it('has responde pela permissão exata', async () => {
    const { repository } = fakeRepository(['platform.role.read']);
    const service = new PermissionService(repository);

    expect(await service.has(TENANT, MEMBERSHIP, 'platform.role.read')).toBe(true);
    expect(await service.has(TENANT, MEMBERSHIP, 'platform.role.create')).toBe(false);
  });
});
