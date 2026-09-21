import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from './cn';

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** Ação principal, ex.: o botão "Novo projeto". */
  action?: ReactNode;
  className?: string;
}

/** Estado vazio de uma lista ou tela. Textos padrão em pt-BR pelo i18n. */
export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed',
        'border-border p-10 text-center',
        className,
      )}
    >
      {Icon !== undefined && <Icon className="size-8 text-muted-foreground" aria-hidden="true" />}
      <h2 className="text-base font-medium">{title ?? t('empty.title')}</h2>
      <p className="text-sm text-muted-foreground">{description ?? t('empty.description')}</p>
      {action !== undefined && <div className="pt-2">{action}</div>}
    </div>
  );
}
