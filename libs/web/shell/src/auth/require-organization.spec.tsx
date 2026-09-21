import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clerk = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: true, orgId: null as string | null },
}));

vi.mock('@clerk/react', () => ({
  useAuth: () => clerk.auth,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OrganizationList: () => <div data-testid="organization-list" />,
}));

import { messages } from '../messages';
import { RequireOrganization } from './require-organization';

function renderGuard() {
  return render(
    <MemoryRouter>
      <RequireOrganization>
        <p>conteúdo do tenant</p>
      </RequireOrganization>
    </MemoryRouter>,
  );
}

describe('F0-12 RequireOrganization', () => {
  beforeEach(() => {
    clerk.auth = { isLoaded: true, isSignedIn: true, orgId: null };
  });

  it('pede a escolha de uma organização quando não há organização ativa', () => {
    renderGuard();

    expect(screen.getByRole('heading', { name: messages.organization.selectTitle })).toBeDefined();
    expect(screen.getByTestId('organization-list')).toBeDefined();
    expect(screen.queryByText('conteúdo do tenant')).toBeNull();
  });

  it('libera o conteúdo quando há organização ativa', () => {
    clerk.auth = { isLoaded: true, isSignedIn: true, orgId: 'org_a' };

    renderGuard();

    expect(screen.getByText('conteúdo do tenant')).toBeDefined();
  });
});
