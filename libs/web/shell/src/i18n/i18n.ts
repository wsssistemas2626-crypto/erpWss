import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ptBRTranslations, type AppTranslations } from './pt-BR';

/**
 * i18n do front (CLAUDE.md §5). Uma instância por árvore React, criada explicitamente
 * em vez de um singleton global: assim um teste monta a sua sem herdar estado de outro.
 */

export const APP_LOCALE = 'pt-BR';
export const DEFAULT_NAMESPACE = 'translation';

export function createI18n(): I18nInstance {
  const instance = i18next.createInstance();

  void instance.use(initReactI18next).init({
    lng: APP_LOCALE,
    fallbackLng: APP_LOCALE,
    supportedLngs: [APP_LOCALE],
    defaultNS: DEFAULT_NAMESPACE,
    resources: { [APP_LOCALE]: { [DEFAULT_NAMESPACE]: ptBRTranslations } },
    // O React já escapa o que renderiza; escapar de novo viraria `&amp;` na tela.
    interpolation: { escapeValue: false },
  });

  return instance;
}

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NAMESPACE;
    resources: { translation: AppTranslations };
  }
}
