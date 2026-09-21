import { describe, expect, it } from 'vitest';
import { APP_LOCALE, createI18n } from './i18n';
import { ptBRTranslations } from './pt-BR';

describe('F0-13 i18n pt-BR', () => {
  it('inicia em pt-BR e resolve as chaves do shell', () => {
    const i18n = createI18n();

    expect(i18n.language).toBe(APP_LOCALE);
    expect(i18n.t('menu.projects')).toBe('Projetos');
    expect(i18n.t('errors.notFoundTitle')).toBe(ptBRTranslations.errors.notFoundTitle);
  });

  it('interpola o resumo da paginação', () => {
    const i18n = createI18n();

    expect(i18n.t('table.summary', { first: 1, last: 20, total: 137 })).toBe('1–20 de 137');
  });

  it('cada instância é independente, para um teste não herdar estado de outro', () => {
    expect(createI18n()).not.toBe(createI18n());
  });

  it('não deixa texto de interface fora do arquivo de tradução', () => {
    const i18n = createI18n();

    for (const key of flatKeys(ptBRTranslations)) {
      expect(i18n.exists(key), `chave ausente: ${key}`).toBe(true);
    }
  });
});

function flatKeys(node: object, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatKeys(value as object, `${prefix}${key}.`),
  );
}
