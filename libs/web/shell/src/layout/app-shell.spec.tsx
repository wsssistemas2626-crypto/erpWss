import { screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// O Clerk é simulado: nenhum teste do `pnpm check` acessa a rede (CLAUDE.md §4.4).
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, orgId: 'org_a' }),
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  OrganizationSwitcher: () => <div data-testid="clerk-organization-switcher" />,
  UserButton: () => <div data-testid="clerk-user-button" />,
}));

import { ptBRTranslations } from '../i18n/pt-BR';
import type { MenuItem } from '../menu/menu';
import { createStubApiClient, meFixture, renderWithShell } from '../testing';
import { AppShell } from './app-shell';

const MENU: readonly MenuItem[] = [
  { labelKey: 'home', to: '/', module: 'platform' },
  {
    labelKey: 'projects',
    to: '/projetos',
    module: 'projects',
    anyOfPermissions: ['projects.project.read'],
  },
  {
    labelKey: 'roles',
    to: '/papeis',
    module: 'platform',
    anyOfPermissions: ['platform.role.read'],
  },
];

function renderShell(me = meFixture()) {
  return renderWithShell(
    <AppShell items={MENU}>
      <p>conteúdo da página</p>
    </AppShell>,
    { me },
  );
}

async function menuLinks(): Promise<string[]> {
  const nav = await screen.findByRole('navigation', { name: ptBRTranslations.menu.label });
  return [...nav.querySelectorAll('a')].map((link) => link.textContent ?? '');
}

describe('F0-13 menu lateral montado a partir de GET /api/v1/me', () => {
  it('não mostra "Projetos" para quem não tem nenhuma permissão do módulo projects', async () => {
    renderShell(meFixture({ modules: ['platform', 'projects'], permissions: [] }));

    expect(await menuLinks()).toEqual([ptBRTranslations.menu.home]);
    expect(screen.queryByRole('link', { name: ptBRTranslations.menu.projects })).toBeNull();
  });

  it('mostra "Projetos" para quem tem a permissão e o módulo habilitado', async () => {
    renderShell(
      meFixture({
        modules: ['platform', 'projects'],
        permissions: ['projects.project.read', 'platform.role.read'],
      }),
    );

    expect(await menuLinks()).toEqual([
      ptBRTranslations.menu.home,
      ptBRTranslations.menu.projects,
      ptBRTranslations.menu.roles,
    ]);
  });

  it('esconde o item quando o módulo não está habilitado no tenant, mesmo com a permissão', async () => {
    renderShell(meFixture({ modules: ['platform'], permissions: ['projects.project.read'] }));

    expect(await menuLinks()).toEqual([ptBRTranslations.menu.home]);
  });

  it('mostra a organização ativa, o seletor de organização e o menu do usuário', async () => {
    renderShell();

    expect(await screen.findByText('Organização de Teste')).toBeDefined();
    expect(screen.getByTestId('clerk-organization-switcher')).toBeDefined();
    expect(screen.getByTestId('clerk-user-button')).toBeDefined();
  });

  it('mostra o conteúdo da rota dentro do main', async () => {
    renderShell();

    const main = await screen.findByRole('main', { name: ptBRTranslations.layout.mainLabel });
    expect(main.textContent).toContain('conteúdo da página');
  });

  it('avisa quando não consegue carregar /me, sem desenhar menu nenhum', async () => {
    renderWithShell(<AppShell items={MENU} />, {
      apiClient: createStubApiClient({}),
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: ptBRTranslations.errors.loadFailedTitle }),
      ).toBeDefined();
    });
    expect(screen.queryByRole('navigation', { name: ptBRTranslations.menu.label })).toBeNull();
  });
});
