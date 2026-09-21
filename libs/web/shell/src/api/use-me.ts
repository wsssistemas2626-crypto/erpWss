import { meResponseSchema, type MeResponse } from '@erp/shared-contracts';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useApi } from './api-provider';

/** Chave da consulta de `GET /api/v1/me`. O cache inteiro é descartado ao trocar de organização. */
export const ME_QUERY_KEY = ['me'] as const;

/**
 * Quem sou eu, o que posso fazer e quais módulos o tenant tem habilitados.
 *
 * É a consulta que o layout faz antes de desenhar o menu (F0-13). Um 403/404 aqui não se
 * resolve tentando de novo, então a consulta não repete.
 */
export function useMe(): UseQueryResult<MeResponse> {
  const api = useApi();

  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: ({ signal }) =>
      api.request({ method: 'GET', path: '/me', schema: meResponseSchema, signal }),
    retry: false,
    staleTime: 60_000,
  });
}
