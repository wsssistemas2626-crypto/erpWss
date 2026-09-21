import type { EntityId } from '@erp/shared-kernel';
import { PermissionRepository } from './permission-repository';

/** Cache curto: o ADR-004 fixa 60 s, e as mutações de papel invalidam na hora. */
export const PERMISSION_CACHE_TTL_MS = 60_000;

interface CacheEntry {
  readonly permissions: ReadonlySet<string>;
  readonly expiresAt: number;
}

/**
 * Permissões efetivas de um membership.
 *
 * Vêm sempre do banco, nunca do token do Clerk (ADR-004: o token tem limite de 4 KB e as
 * permissões são granulares demais). Para não pagar uma consulta por requisição, ficam em
 * cache por 60 s; qualquer alteração de papel invalida o tenant inteiro na hora.
 */
export class PermissionService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly repository: PermissionRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async permissionsOf(tenantId: EntityId, membershipId: EntityId): Promise<ReadonlySet<string>> {
    const key = `${tenantId}:${membershipId}`;
    const cached = this.cache.get(key);
    if (cached !== undefined && cached.expiresAt > this.now()) {
      return cached.permissions;
    }

    const permissions = new Set(
      await this.repository.findPermissionsByMembership(tenantId, membershipId),
    );
    this.cache.set(key, { permissions, expiresAt: this.now() + PERMISSION_CACHE_TTL_MS });
    return permissions;
  }

  async has(tenantId: EntityId, membershipId: EntityId, permission: string): Promise<boolean> {
    return (await this.permissionsOf(tenantId, membershipId)).has(permission);
  }

  /**
   * Invalida o tenant inteiro, e não só o membership alterado: mexer num papel muda as
   * permissões de todo mundo que o tem, e descobrir quem são custa mais do que recarregar.
   */
  invalidateTenant(tenantId: EntityId): void {
    const prefix = `${tenantId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}
