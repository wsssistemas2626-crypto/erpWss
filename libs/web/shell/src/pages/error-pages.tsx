import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

interface ErrorPageProps {
  title: string;
  description: string;
}

function ErrorPage({ title, description }: ErrorPageProps) {
  const { t } = useTranslation();

  return (
    <main className="mx-auto flex max-w-lg flex-col items-start gap-2 p-10">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
        {t('errors.backToStart')}
      </Link>
    </main>
  );
}

/** 401 — sessão ausente ou expirada. */
export function UnauthenticatedPage() {
  const { t } = useTranslation();
  return (
    <ErrorPage
      title={t('errors.unauthenticatedTitle')}
      description={t('errors.unauthenticatedDescription')}
    />
  );
}

/** 403 — autenticado, mas sem a permissão exigida pelo RBAC local (ADR-004). */
export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <ErrorPage title={t('errors.forbiddenTitle')} description={t('errors.forbiddenDescription')} />
  );
}

/** 404 — rota inexistente. */
export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <ErrorPage title={t('errors.notFoundTitle')} description={t('errors.notFoundDescription')} />
  );
}
