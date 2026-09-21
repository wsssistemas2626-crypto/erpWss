import { useAuth } from '@clerk/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { SIGN_IN_PATH } from './app-providers';

/** Tela neutra enquanto o Clerk hidrata a sessão, para não piscar o login. */
export function SessionLoading() {
  const { t } = useTranslation();
  return (
    <p role="status" className="p-6 text-sm text-muted-foreground">
      {t('auth.loading')}
    </p>
  );
}

export interface RequireAuthProps {
  /** Ausente quando usado como rota-pai do React Router (renderiza `<Outlet/>`). */
  children?: ReactNode;
}

/**
 * Protege as rotas autenticadas: sem sessão, redireciona para `/entrar` guardando
 * a rota pretendida em `state.from` para voltar a ela depois do login.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return <SessionLoading />;
  }

  if (!isSignedIn) {
    return <Navigate to={SIGN_IN_PATH} replace state={{ from: location.pathname }} />;
  }

  return <>{children ?? <Outlet />}</>;
}
