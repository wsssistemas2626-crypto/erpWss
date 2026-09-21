import { OrganizationSwitcher, UserButton } from '@clerk/react';
import { messages } from '@erp/web-shell';
import { Outlet } from 'react-router';

/**
 * Cabeçalho das rotas autenticadas. O menu por permissão e o layout definitivo
 * chegam no item F0-13.
 */
export function AppLayout() {
  return (
    <>
      <header>
        <span>{messages.appName}</span>
        <nav aria-label={messages.organization.switcherLabel}>
          <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" />
        </nav>
        <UserButton />
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
