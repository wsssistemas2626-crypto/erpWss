import { Link } from 'react-router';
import { messages } from '../messages';

interface ErrorPageProps {
  title: string;
  description: string;
}

function ErrorPage({ title, description }: ErrorPageProps) {
  return (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link to="/">{messages.errors.backToStart}</Link>
    </main>
  );
}

/** 401 — sessão ausente ou expirada. */
export function UnauthenticatedPage() {
  return (
    <ErrorPage
      title={messages.errors.unauthenticatedTitle}
      description={messages.errors.unauthenticatedDescription}
    />
  );
}

/** 403 — autenticado, mas sem a permissão exigida pelo RBAC local (ADR-004). */
export function ForbiddenPage() {
  return (
    <ErrorPage
      title={messages.errors.forbiddenTitle}
      description={messages.errors.forbiddenDescription}
    />
  );
}

/** 404 — rota inexistente. */
export function NotFoundPage() {
  return (
    <ErrorPage
      title={messages.errors.notFoundTitle}
      description={messages.errors.notFoundDescription}
    />
  );
}
