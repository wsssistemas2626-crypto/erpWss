import { SignIn } from '@clerk/react';
import { SIGN_IN_PATH, SIGN_UP_PATH, messages } from '@erp/web-shell';

/** Rota pública. Login, cadastro e MFA são inteiramente do Clerk (CLAUDE.md §4.4). */
export function SignInPage() {
  return (
    <main>
      <h1>{messages.auth.signInTitle}</h1>
      <SignIn routing="path" path={SIGN_IN_PATH} signUpUrl={SIGN_UP_PATH} />
    </main>
  );
}
