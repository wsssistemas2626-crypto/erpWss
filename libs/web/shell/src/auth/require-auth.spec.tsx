import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: false as boolean, orgId: null as string | null },
}));

vi.mock('@clerk/react', () => ({
  useAuth: () => clerk.auth,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OrganizationList: () => <div data-testid="organization-list" />,
}));

import { RequireAuth } from './require-auth';

function renderProtected(initialPath = '/projetos') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/entrar" element={<p>tela de login</p>} />
        <Route element={<RequireAuth />}>
          <Route path="/projetos" element={<p>conteúdo protegido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('F0-12 RequireAuth', () => {
  beforeEach(() => {
    clerk.auth = { isLoaded: true, isSignedIn: false, orgId: null };
  });

  it('redireciona para /entrar quando acesso uma rota protegida sem sessão', () => {
    renderProtected();

    expect(screen.getByText('tela de login')).toBeDefined();
    expect(screen.queryByText('conteúdo protegido')).toBeNull();
  });

  it('libera a rota protegida quando há sessão', () => {
    clerk.auth = { isLoaded: true, isSignedIn: true, orgId: 'org_a' };

    renderProtected();

    expect(screen.getByText('conteúdo protegido')).toBeDefined();
  });

  it('mostra o aviso de carregamento enquanto o Clerk não hidratou a sessão', () => {
    clerk.auth = { isLoaded: false, isSignedIn: false, orgId: null };

    renderProtected();

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.queryByText('tela de login')).toBeNull();
  });
});
