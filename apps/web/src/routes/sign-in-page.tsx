import { SignIn } from '@clerk/react';
import { SIGN_IN_PATH, SIGN_UP_PATH } from '@erp/web-shell';
import { useTranslation } from 'react-i18next';

/** Rota pública. Login, cadastro e MFA são inteiramente do Clerk (CLAUDE.md §4.4). */
export function SignInPage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">{t('auth.signInTitle')}</h1>
      <SignIn routing="path" path={SIGN_IN_PATH} signUpUrl={SIGN_UP_PATH} />
    </main>
  );
}
