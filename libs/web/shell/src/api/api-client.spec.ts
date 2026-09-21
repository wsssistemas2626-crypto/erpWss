import { PROBLEM_CONTENT_TYPE } from '@erp/shared-contracts';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { z } from 'zod';
import { ApiClient, ApiError } from './api-client';

const projectSchema = z.object({ id: z.string(), name: z.string() });

/** Argumentos da n-ésima chamada do `fetch` simulado, com erro claro se ela não ocorreu. */
function callArgs(fetchImpl: Mock, index: number): [string, RequestInit] {
  const args = fetchImpl.mock.calls[index];
  if (args === undefined) {
    throw new Error(`fetch não foi chamado ${index + 1} vez(es)`);
  }
  return args as [string, RequestInit];
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('F0-12 ApiClient', () => {
  it('envia o token do Clerk no header Authorization a cada chamada', async () => {
    const getToken = vi.fn().mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2');
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 'p1', name: 'Alfa' }));
    const client = new ApiClient({ baseUrl: '/api/v1', getToken, fetchImpl });

    await client.get('/projects/p1', projectSchema);
    await client.get('/projects/p1', projectSchema);

    expect(getToken).toHaveBeenCalledTimes(2);
    const headersOf = (call: number) =>
      callArgs(fetchImpl, call)[1].headers as Record<string, string>;
    expect(headersOf(0)['Authorization']).toBe('Bearer token-1');
    expect(headersOf(1)['Authorization']).toBe('Bearer token-2');
  });

  it('monta a URL com os parâmetros de consulta, ignorando os indefinidos', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'p1', name: 'Alfa' }));
    const client = new ApiClient({ baseUrl: '/api/v1/', getToken: async () => 'tk', fetchImpl });

    await client.get('/projects', projectSchema, { page: 2, pageSize: 20, search: undefined });

    expect(callArgs(fetchImpl, 0)[0]).toBe('/api/v1/projects?page=2&pageSize=20');
  });

  it('falha sem chamar a API quando não há sessão', async () => {
    const fetchImpl = vi.fn();
    const client = new ApiClient({ baseUrl: '/api/v1', getToken: async () => null, fetchImpl });

    await expect(client.get('/projects', projectSchema)).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('converte problem+json em ApiError preservando status e code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          code: 'permission_denied',
        },
        { status: 403, headers: { 'content-type': PROBLEM_CONTENT_TYPE } },
      ),
    );
    const client = new ApiClient({ baseUrl: '/api/v1', getToken: async () => 'tk', fetchImpl });

    const error = await client.get('/projects', projectSchema).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).code).toBe('permission_denied');
  });

  it('usa um erro genérico quando o corpo de erro não é problem+json', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response('falha do gateway', { status: 502, statusText: 'Bad Gateway' }),
      );
    const client = new ApiClient({ baseUrl: '/api/v1', getToken: async () => 'tk', fetchImpl });

    const error = (await client
      .get('/projects', projectSchema)
      .catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(502);
    expect(error.code).toBe('unexpected_error');
  });

  it('rejeita resposta que não casa com o schema do contrato', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'p1' }));
    const client = new ApiClient({ baseUrl: '/api/v1', getToken: async () => 'tk', fetchImpl });

    const error = (await client
      .get('/projects/p1', projectSchema)
      .catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe('invalid_response');
  });

  it('não espera corpo em DELETE', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ApiClient({ baseUrl: '/api/v1', getToken: async () => 'tk', fetchImpl });

    await expect(client.delete('/projects/p1')).resolves.toBeUndefined();
    expect(callArgs(fetchImpl, 0)[1].method).toBe('DELETE');
  });
});
