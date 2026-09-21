import { SignUp } from '@clerk/react';
import { SIGN_IN_PATH, SIGN_UP_PATH } from '@erp/web-shell';
import { useTranslation } from 'react-i18next';

/** Rota pública de cadastro. O provisionamento do usuário no banco local é JIT (F0-11). */
export function SignUpPage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">{t('auth.signUpTitle')}</h1>
      <SignUp routing="path" path={SIGN_UP_PATH} signInUrl={SIGN_IN_PATH} />
    </main>
  );
}
