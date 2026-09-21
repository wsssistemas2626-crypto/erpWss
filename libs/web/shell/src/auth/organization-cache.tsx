import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

/**
 * Descarta o cache do TanStack Query quando a organização ativa muda.
 *
 * Todo dado em cache pertence a um tenant (ADR-001); reaproveitá-lo depois da troca
 * mostraria dados da organização anterior na tela da nova.
 */
export function useClearCacheOnOrganizationChange(): void {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const previousOrgId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const isFirstRender = previousOrgId.current === undefined;
    if (!isFirstRender && previousOrgId.current !== orgId) {
      queryClient.clear();
    }
    previousOrgId.current = orgId ?? null;
  }, [orgId, queryClient]);
}

/** Monta o efeito acima dentro da árvore de providers, sem renderizar nada. */
export function OrganizationCacheReset(): null {
  useClearCacheOnOrganizationChange();
  return null;
}
