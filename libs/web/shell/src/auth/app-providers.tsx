import { ClerkProvider } from '@clerk/react';
import { ptBR } from '@clerk/localizations';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ApiClient } from '../api/api-client';
import { ApiProvider } from '../api/api-provider';
import { I18nProvider } from '../i18n/i18n-provider';
import { OrganizationCacheReset } from './organization-cache';

/** Rota pública de login; usada também como destino após o logout. */
export const SIGN_IN_PATH = '/entrar';

/** Rota pública de cadastro, para onde o link "Cadastrar" do `<SignIn/>` aponta. */
export const SIGN_UP_PATH = '/cadastrar';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // O token do Clerk é renovado a cada chamada; refazer a consulta ao focar
        // a janela só geraria ruído durante a navegação.
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export interface AppProvidersProps {
  publishableKey: string;
  children: ReactNode;
  /** Injetável nos testes para inspecionar o cache. */
  queryClient?: QueryClient;
  /** Injetável nos testes, para o front não tocar a rede. */
  apiClient?: ApiClient;
}

/**
 * Providers do front: Clerk (localizado em pt-BR, ADR-004), i18n, TanStack Query e o
 * cliente HTTP. O `ClerkProvider` fica por fora porque o `ApiProvider` precisa do
 * `getToken()` da sessão.
 */
export function AppProviders({
  publishableKey,
  children,
  queryClient,
  apiClient,
}: AppProvidersProps) {
  const client = queryClient ?? createQueryClient();

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={ptBR}
      afterSignOutUrl={SIGN_IN_PATH}
    >
      <I18nProvider>
        <QueryClientProvider client={client}>
          <ApiProvider client={apiClient}>
            <OrganizationCacheReset />
            {children}
          </ApiProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ClerkProvider>
  );
}
