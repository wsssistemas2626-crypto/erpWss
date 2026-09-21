import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: true, orgId: 'org_a' as string | null },
}));

vi.mock('@clerk/react', () => ({
  useAuth: () => clerk.auth,
}));

import { OrganizationCacheReset } from './organization-cache';

const PROJECTS_KEY = ['projects'];

function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(PROJECTS_KEY, [{ id: 'p1', name: 'Projeto da organização A' }]);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = render(<OrganizationCacheReset />, { wrapper });
  return { queryClient, view };
}

describe('F0-12 troca de organização', () => {
  beforeEach(() => {
    clerk.auth = { isLoaded: true, isSignedIn: true, orgId: 'org_a' };
  });

  it('descarta o cache de dados quando troco a organização ativa de A para B', () => {
    const { queryClient, view } = setup();
    expect(queryClient.getQueryData(PROJECTS_KEY)).toBeDefined();

    clerk.auth = { ...clerk.auth, orgId: 'org_b' };
    view.rerender(<OrganizationCacheReset />);

    expect(queryClient.getQueryData(PROJECTS_KEY)).toBeUndefined();
  });

  it('preserva o cache enquanto a organização ativa não muda', () => {
    const { queryClient, view } = setup();

    view.rerender(<OrganizationCacheReset />);

    expect(queryClient.getQueryData(PROJECTS_KEY)).toBeDefined();
  });

  it('descarta o cache ao sair da organização ativa', () => {
    const { queryClient, view } = setup();

    clerk.auth = { ...clerk.auth, orgId: null };
    view.rerender(<OrganizationCacheReset />);

    expect(queryClient.getQueryData(PROJECTS_KEY)).toBeUndefined();
  });
});
