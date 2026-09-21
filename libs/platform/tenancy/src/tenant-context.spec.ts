import { DomainError } from '@erp/shared-kernel';
import { describe, expect, it } from 'vitest';
import {
  TENANT_CONTEXT_MISSING,
  getTenantContext,
  requireTenantId,
  runInTenantContext,
} from './tenant-context';

const TENANT_A = '0199a0d0-0000-7000-8000-00000000000a';
const TENANT_B = '0199a0d0-0000-7000-8000-00000000000b';

describe('F0-05 TenantContext', () => {
  it('expõe o tenant dentro do escopo e nada fora dele', () => {
    const dentro = runInTenantContext({ tenantId: TENANT_A }, () => requireTenantId());

    expect(dentro).toBe(TENANT_A);
    expect(getTenantContext()).toBeUndefined();
  });

  it('falha com DomainError estável quando não há tenant no contexto', () => {
    try {
      requireTenantId();
      throw new Error('deveria ter falhado');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe(TENANT_CONTEXT_MISSING);
    }
  });

  it('atravessa await sem vazar para o escopo de fora', async () => {
    const lido = await runInTenantContext({ tenantId: TENANT_A }, async () => {
      await Promise.resolve();
      return requireTenantId();
    });

    expect(lido).toBe(TENANT_A);
    expect(getTenantContext()).toBeUndefined();
  });

  it('mantém contextos concorrentes separados', async () => {
    const [a, b] = await Promise.all([
      runInTenantContext({ tenantId: TENANT_A }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return requireTenantId();
      }),
      runInTenantContext({ tenantId: TENANT_B }, async () => requireTenantId()),
    ]);

    expect([a, b]).toEqual([TENANT_A, TENANT_B]);
  });

  it('aninhar troca o tenant só no escopo interno', () => {
    const lido = runInTenantContext({ tenantId: TENANT_A }, () => {
      const interno = runInTenantContext({ tenantId: TENANT_B }, () => requireTenantId());
      return { interno, externo: requireTenantId() };
    });

    expect(lido).toEqual({ interno: TENANT_B, externo: TENANT_A });
  });
});
