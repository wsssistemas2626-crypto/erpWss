import { SignUp } from '@clerk/react';
import { SIGN_IN_PATH, SIGN_UP_PATH, messages } from '@erp/web-shell';

/** Rota pública de cadastro. O provisionamento do usuário no banco local é JIT (F0-11). */
export function SignUpPage() {
  return (
    <main>
      <h1>{messages.auth.signUpTitle}</h1>
      <SignUp routing="path" path={SIGN_UP_PATH} signInUrl={SIGN_IN_PATH} />
    </main>
  );
}
