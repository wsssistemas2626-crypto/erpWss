import type { MeResponse } from '@erp/shared-contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import type { ApiClient } from '../api/api-client';
import { ApiProvider } from '../api/api-provider';
import { I18nProvider } from '../i18n/i18n-provider';
import { createStubApiClient, meFixture } from './stub-api';

export interface RenderWithShellOptions {
  /** Rota inicial do `MemoryRouter`. */
  route?: string;
  /** Resposta de `GET /api/v1/me`; o padrão é o `meFixture()`. */
  me?: MeResponse;
  /** Outras respostas da API, indexadas pelo caminho sem o prefixo `/api/v1`. */
  responses?: Record<string, unknown>;
  apiClient?: ApiClient;
}

/**
 * Monta uma árvore com os providers do shell (i18n, TanStack Query e cliente HTTP
 * simulado) e roteamento em memória. O Clerk fica por conta de cada teste: quem precisa
 * dele o simula com `vi.mock('@clerk/react')`.
 */
export function renderWithShell(ui: ReactNode, options: RenderWithShellOptions = {}): RenderResult {
  const client =
    options.apiClient ??
    createStubApiClient({ '/me': options.me ?? meFixture(), ...options.responses });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={client}>
          <MemoryRouter initialEntries={[options.route ?? '/']}>{ui}</MemoryRouter>
        </ApiProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}
