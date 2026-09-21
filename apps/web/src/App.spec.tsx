import { ptBRTranslations } from '@erp/web-shell';
import { meFixture, renderWithShell } from '@erp/web-shell/testing';
import type { MeResponse } from '@erp/shared-contracts';
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
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

function renderAt(path: string, me: MeResponse = meFixture()) {
  return renderWithShell(<App />, { route: path, me });
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

    expect(
      screen.getByRole('heading', { name: ptBRTranslations.organization.selectTitle }),
    ).toBeDefined();
  });

  it('mostra o seletor de organização e o menu do usuário nas rotas autenticadas', async () => {
    renderAt('/');

    expect(await screen.findByTestId('clerk-organization-switcher')).toBeDefined();
    expect(screen.getByTestId('clerk-user-button')).toBeDefined();
    expect(screen.getByText(ptBRTranslations.shellPlaceholder)).toBeDefined();
  });

  it('serve a tela de login como rota pública', () => {
    clerk.auth = { isLoaded: true, isSignedIn: false, orgId: null };

    renderAt('/entrar');

    expect(screen.getByRole('heading', { name: ptBRTranslations.auth.signInTitle })).toBeDefined();
  });

  it('serve a tela de cadastro como rota pública', () => {
    clerk.auth = { isLoaded: true, isSignedIn: false, orgId: null };

    renderAt('/cadastrar');

    expect(screen.getByRole('heading', { name: ptBRTranslations.auth.signUpTitle })).toBeDefined();
    expect(screen.getByTestId('clerk-sign-up')).toBeDefined();
  });

  it('mostra a página 403 em acesso negado', async () => {
    renderAt('/403');

    expect(
      await screen.findByRole('heading', { name: ptBRTranslations.errors.forbiddenTitle }),
    ).toBeDefined();
  });

  it('mostra a página 401 quando a sessão expira', () => {
    clerk.auth = { isLoaded: true, isSignedIn: false, orgId: null };

    renderAt('/401');

    expect(
      screen.getByRole('heading', { name: ptBRTranslations.errors.unauthenticatedTitle }),
    ).toBeDefined();
  });

  it('mostra a página 404 em rota inexistente', () => {
    renderAt('/rota-que-nao-existe');

    expect(
      screen.getByRole('heading', { name: ptBRTranslations.errors.notFoundTitle }),
    ).toBeDefined();
  });
});

describe('F0-13 menu respeita permissões', () => {
  beforeEach(() => {
    clerk.auth = { isLoaded: true, isSignedIn: true, orgId: 'org_a' };
  });

  it('não mostra "Projetos" para um usuário sem nenhuma permissão do módulo projects', async () => {
    renderAt('/', meFixture({ modules: ['platform', 'projects'], permissions: [] }));

    await screen.findByRole('navigation', { name: ptBRTranslations.menu.label });

    expect(screen.queryByRole('link', { name: ptBRTranslations.menu.projects })).toBeNull();
    expect(screen.getByRole('link', { name: ptBRTranslations.menu.home })).toBeDefined();
  });

  it('mostra "Projetos" quando o usuário tem a permissão e o módulo está habilitado', async () => {
    renderAt(
      '/',
      meFixture({
        modules: ['platform', 'projects'],
        permissions: ['projects.project.read', 'platform.audit.read'],
      }),
    );

    expect(await screen.findByRole('link', { name: ptBRTranslations.menu.projects })).toBeDefined();
    expect(screen.getByRole('link', { name: ptBRTranslations.menu.audit })).toBeDefined();
    expect(screen.queryByRole('link', { name: ptBRTranslations.menu.roles })).toBeNull();
  });
});
