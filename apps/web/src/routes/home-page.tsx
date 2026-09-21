import { EmptyState } from '@erp/web-shell';
import { useTranslation } from 'react-i18next';

/** Tela inicial. Ganha conteúdo de verdade quando o módulo de Projetos chegar (Fase 1). */
export function HomePage() {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('appName')}</h1>
      <EmptyState description={t('shellPlaceholder')} />
    </section>
  );
}
