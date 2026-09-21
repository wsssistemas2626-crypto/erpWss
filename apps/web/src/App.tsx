import {
  ForbiddenPage,
  NotFoundPage,
  RequireAuth,
  RequireOrganization,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  UnauthenticatedPage,
} from '@erp/web-shell';
import { Route, Routes } from 'react-router';
import { AppLayout } from './layout/app-layout';
import { HomePage } from './routes/home-page';
import { SignInPage } from './routes/sign-in-page';
import { SignUpPage } from './routes/sign-up-page';

/**
 * Mapa de rotas. Sem router próprio: `main.tsx` monta o `BrowserRouter` e os testes
 * montam um `MemoryRouter`, para exercitar redirecionamentos sem navegador real.
 */
export function App() {
  return (
    <Routes>
      <Route path={`${SIGN_IN_PATH}/*`} element={<SignInPage />} />
      <Route path={`${SIGN_UP_PATH}/*`} element={<SignUpPage />} />
      <Route path="/401" element={<UnauthenticatedPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<RequireOrganization />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/403" element={<ForbiddenPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
