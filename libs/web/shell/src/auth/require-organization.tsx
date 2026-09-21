import { OrganizationList, useAuth } from '@clerk/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { SessionLoading } from './require-auth';

export interface RequireOrganizationProps {
  children?: ReactNode;
}

/**
 * O tenant é a organização ativa do Clerk (ADR-004): sem organização ativa não há
 * `o.id` no token e o backend não resolve o tenant, então o app não pode seguir.
 */
export function RequireOrganization({ children }: RequireOrganizationProps) {
  const { t } = useTranslation();
  const { isLoaded, orgId } = useAuth();

  if (!isLoaded) {
    return <SessionLoading />;
  }

  if (!orgId) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-3 p-10">
        <h1 className="text-xl font-semibold">{t('organization.selectTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('organization.selectDescription')}</p>
        <OrganizationList hidePersonal afterSelectOrganizationUrl="/" />
      </main>
    );
  }

  return <>{children ?? <Outlet />}</>;
}
