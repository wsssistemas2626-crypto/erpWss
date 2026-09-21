import { OrganizationSwitcher, UserButton } from '@clerk/react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import type { ReactNode } from 'react';
import { useMe } from '../api/use-me';
import { SessionLoading } from '../auth/require-auth';
import { visibleMenuItems, type MenuItem } from '../menu/menu';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';

export interface AppShellProps {
  /** Menu declarado na composição do app; cada item traz o módulo e as permissões que exige. */
  items: readonly MenuItem[];
  /** Ausente quando usado como rota-pai do React Router (renderiza `<Outlet/>`). */
  children?: ReactNode;
}

/**
 * Layout das rotas autenticadas (F0-13).
 *
 * O menu lateral é montado a partir de `GET /api/v1/me`: módulos habilitados no tenant e
 * permissões efetivas do usuário. Item sem módulo habilitado ou sem permissão não é
 * desenhado — o front não esconde com CSS o que o backend recusaria.
 */
export function AppShell({ items, children }: AppShellProps) {
  const { t } = useTranslation();
  const me = useMe();

  if (me.isPending) {
    return <SessionLoading />;
  }

  if (me.isError) {
    return (
      <main className="flex flex-col items-center gap-3 p-10 text-center">
        <h1 className="text-lg font-semibold">{t('errors.loadFailedTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('errors.loadFailedDescription')}</p>
        <Button onClick={() => void me.refetch()}>{t('errors.retry')}</Button>
      </main>
    );
  }

  const visible = visibleMenuItems(items, {
    modules: me.data.modules,
    permissions: me.data.permissions,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4">
        <span className="text-base font-semibold">{t('appName')}</span>
        {me.data.tenant !== null && (
          <span className="text-sm text-muted-foreground">{me.data.tenant.name}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <nav aria-label={t('organization.switcherLabel')}>
            <OrganizationSwitcher hidePersonal afterSelectOrganizationUrl="/" />
          </nav>
          <UserButton />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-60 shrink-0 border-r border-border p-3">
          <nav aria-label={t('menu.label')}>
            <ul className="flex flex-col gap-1">
              {visible.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                        isActive
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted',
                      )
                    }
                  >
                    {item.icon !== undefined && <item.icon className="size-4" aria-hidden="true" />}
                    {t(`menu.${item.labelKey}`)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main aria-label={t('layout.mainLabel')} className="flex-1 p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
