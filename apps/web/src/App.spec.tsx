import { messages } from '@erp/web-shell';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: true, orgId: 'org_a' as string | null },
}));

// O Clerk é simulado: nenhum teste do `pnpm check` acessa a rede (CLAUDE.md §4.4).
vi.mock('@clerk/react', () => ({
  useAuth: () => clerk.auth,
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignIn: () => <div data-testid="clerk-sign-in" />,
  SignUp: () => <div data-testid="clerk-sign-up" />,
  OrganizationSwitcher: () => <div data-testid="clerk-organization-switcher" />,
  OrganizationList: () => <div data-testid="clerk-organization-list" />,
  UserButton: () => <div data-testid="clerk-user-button" />,
}));

import { App } from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('F0-12 rotas do front', () => {
  beforeEach(() => {
    clerk.auth = { isLoaded: true, isSignedIn: true, orgId: 'org_a' };
  });

  it('redireciona para a tela de login ao acessar uma rota protegida sem sessão', () => {
    clerk.auth = { isLoaded: true, isSignedIn: false, orgId: null };

    renderAt('/');

    expect(screen.getByTestId('clerk-sign-in')).toBeDefined();
  });

  it('mostra a tela de escolha de organização quando a sessão não tem organização ativa', () => {
    clerk.auth = { isLoaded: true, isSignedIn: true, orgId: null };

    renderAt('/');

    expect(screen.getByRole('heading', { name: messages.organization.selectTitle })).toBeDefined();
  });

  it('mostra o seletor de organização e o menu do usuário nas rotas autenticadas', () => {
    renderAt('/');

    expect(screen.getByTestId('clerk-organization-switcher')).toBeDefined();
    expect(screen.getByTestId('clerk-user-button')).toBeDefined();
    expect(screen.getByText(messages.shellPlaceholder)).toBeDefined();
  });

  it('serve a tela de login como rota pública', () => {
    clerk.auth = { isLoaded: true, isSignedIn: false, orgId: null };

    renderAt('/entrar');

    expect(screen.getByRole('heading', { name: messages.auth.signInTitle })).toBeDefined();
  });

  it('serve a tela de cadastro como rota pública', () => {
    clerk.auth = { isLoaded: true, isSignedIn: false, orgId: null };

    renderAt('/cadastrar');

    expect(screen.getByRole('heading', { name: messages.auth.signUpTitle })).toBeDefined();
    expect(screen.getByTestId('clerk-sign-up')).toBeDefined();
  });

  it('mostra a página 403 em acesso negado', () => {
    renderAt('/403');

    expect(screen.getByRole('heading', { name: messages.errors.forbiddenTitle })).toBeDefined();
  });

  it('mostra a página 401 quando a sessão expira', () => {
    clerk.auth = { isLoaded: true, isSignedIn: false, orgId: null };

    renderAt('/401');

    expect(
      screen.getByRole('heading', { name: messages.errors.unauthenticatedTitle }),
    ).toBeDefined();
  });

  it('mostra a página 404 em rota inexistente', () => {
    renderAt('/rota-que-nao-existe');

    expect(screen.getByRole('heading', { name: messages.errors.notFoundTitle })).toBeDefined();
  });
});
