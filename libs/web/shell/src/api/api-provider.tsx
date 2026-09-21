import { useAuth } from '@clerk/react';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ApiClient } from './api-client';

/** Prefixo da API (CLAUDE.md §5). O Vite faz o proxy para a API em desenvolvimento. */
export const API_BASE_URL = '/api/v1';

const ApiContext = createContext<ApiClient | null>(null);

export interface ApiProviderProps {
  children: ReactNode;
  baseUrl?: string;
  /** Injetável nos testes, para não tocar a rede. */
  client?: ApiClient;
}

/**
 * Deixa um `ApiClient` ao alcance de qualquer tela.
 *
 * Sem cliente injetado, monta um amarrado à sessão do Clerk — e aí precisa ficar dentro
 * do `ClerkProvider`, que é de onde sai o `getToken()` (ADR-004). Com cliente injetado,
 * o Clerk nem é consultado: é assim que um teste de componente roda sem sessão nenhuma.
 */
export function ApiProvider({ children, baseUrl = API_BASE_URL, client }: ApiProviderProps) {
  if (client !== undefined) {
    return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
  }

  return <ClerkApiProvider baseUrl={baseUrl}>{children}</ClerkApiProvider>;
}

function ClerkApiProvider({ children, baseUrl }: { children: ReactNode; baseUrl: string }) {
  const { getToken } = useAuth();

  const value = useMemo(
    () => new ApiClient({ baseUrl, getToken: () => getToken() }),
    [baseUrl, getToken],
  );

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (client === null) {
    throw new Error('useApi() fora de um <ApiProvider>.');
  }
  return client;
}
