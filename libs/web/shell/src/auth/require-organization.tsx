import { OrganizationList, useAuth } from '@clerk/react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { messages } from '../messages';
import { SessionLoading } from './require-auth';

export interface RequireOrganizationProps {
  children?: ReactNode;
}

/**
 * O tenant é a organização ativa do Clerk (ADR-004): sem organização ativa não há
 * `o.id` no token e o backend não resolve o tenant, então o app não pode seguir.
 */
export function RequireOrganization({ children }: RequireOrganizationProps) {
  const { isLoaded, orgId } = useAuth();

  if (!isLoaded) {
    return <SessionLoading />;
  }

  if (!orgId) {
    return (
      <main>
        <h1>{messages.organization.selectTitle}</h1>
        <p>{messages.organization.selectDescription}</p>
        <OrganizationList hidePersonal afterSelectOrganizationUrl="/" />
      </main>
    );
  }

  return <>{children ?? <Outlet />}</>;
}
