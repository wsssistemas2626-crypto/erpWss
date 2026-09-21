import { useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';
import { createI18n } from './i18n';

export interface I18nProviderProps {
  children: ReactNode;
  /** Injetável nos testes; por padrão uma instância nova em pt-BR. */
  instance?: I18nInstance;
}

export function I18nProvider({ children, instance }: I18nProviderProps) {
  // `useState` com inicializador: uma instância por árvore, criada uma vez só.
  const [i18n] = useState(() => instance ?? createI18n());

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
