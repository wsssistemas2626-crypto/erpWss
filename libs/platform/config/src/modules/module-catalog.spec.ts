import { describe, expect, it } from 'vitest';
import { ModuleCatalog } from './module-catalog';

describe('F0-13 catálogo de módulos', () => {
  it('devolve os módulos registrados em ordem alfabética', () => {
    const catalog = new ModuleCatalog();
    catalog.register([
      { key: 'projects', description: 'Projetos' },
      { key: 'platform', description: 'Administração da plataforma' },
    ]);

    expect(catalog.keys()).toEqual(['platform', 'projects']);
  });

  it('recusa módulo com chave fora do formato', () => {
    const catalog = new ModuleCatalog();

    expect(() => catalog.register([{ key: 'Projetos!', description: 'x' }])).toThrow(
      /fora do formato/,
    );
  });

  it('recusa o mesmo módulo registrado duas vezes', () => {
    const catalog = new ModuleCatalog();
    catalog.register([{ key: 'projects', description: 'Projetos' }]);

    expect(() => catalog.register([{ key: 'projects', description: 'Outro' }])).toThrow(
      /duas vezes/,
    );
  });
});
