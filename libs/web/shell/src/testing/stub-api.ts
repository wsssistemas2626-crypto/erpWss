import type { MeResponse } from '@erp/shared-contracts';
import { ApiClient } from '../api/api-client';
import { API_BASE_URL } from '../api/api-provider';

/**
 * Cliente HTTP de teste: responde de um mapa em memória, sem tocar a rede
 * (CLAUDE.md §4.4). O `ApiClient` de verdade é exercitado, schemas zod inclusive.
 */
export function createStubApiClient(responses: Record<string, unknown>): ApiClient {
  return new ApiClient({
    baseUrl: API_BASE_URL,
    getToken: () => Promise.resolve('token-de-teste'),
    fetchImpl: (input) => {
      const path = new URL(String(input), 'http://localhost').pathname.slice(API_BASE_URL.length);
      const body = responses[path];

      if (body === undefined) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              type: 'about:blank',
              title: 'Não encontrado',
              status: 404,
              code: 'not_found',
            }),
            { status: 404, headers: { 'content-type': 'application/problem+json' } },
          ),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    },
  });
}

const TENANT_FIXTURE = {
  id: '01998a2b-0000-7000-8000-0000000000a0',
  name: 'Organização de Teste',
  slug: 'organizacao-de-teste',
  status: 'ACTIVE',
} as const;

/** Resposta de `GET /api/v1/me` para os testes; sobrescreva o que o cenário precisar. */
export function meFixture(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user: {
      id: '01998a2b-0000-7000-8000-000000000001',
      email: 'pessoa@example.com',
      name: 'Pessoa de Teste',
    },
    tenant: { ...TENANT_FIXTURE },
    membershipStatus: 'ACTIVE',
    permissions: [],
    modules: ['platform'],
    ...overrides,
  };
}
