import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: true, orgId: null as string | null },
}));

vi.mock('@clerk/react', () => ({
  useAuth: () => clerk.auth,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OrganizationList: () => <div data-testid="organization-list" />,
}));

import { ptBRTranslations } from '../i18n/pt-BR';
import { renderWithShell } from '../testing';
import { RequireOrganization } from './require-organization';

function renderGuard() {
  return renderWithShell(
    <RequireOrganization>
      <p>conteúdo do tenant</p>
    </RequireOrganization>,
  );
}

describe('F0-12 RequireOrganization', () => {
  beforeEach(() => {
    clerk.auth = { isLoaded: true, isSignedIn: true, orgId: null };
  });

  it('pede a escolha de uma organização quando não há organização ativa', () => {
    renderGuard();

    expect(
      screen.getByRole('heading', { name: ptBRTranslations.organization.selectTitle }),
    ).toBeDefined();
    expect(screen.getByTestId('organization-list')).toBeDefined();
    expect(screen.queryByText('conteúdo do tenant')).toBeNull();
  });

  it('libera o conteúdo quando há organização ativa', () => {
    clerk.auth = { isLoaded: true, isSignedIn: true, orgId: 'org_a' };

    renderGuard();

    expect(screen.getByText('conteúdo do tenant')).toBeDefined();
  });
});
