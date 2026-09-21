import { DomainError } from '@erp/shared-kernel';
import { describe, expect, it } from 'vitest';
import { PermissionCatalog } from './permission-catalog';
import { ADMINISTRATOR_ROLE } from './system-roles';

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof DomainError ? error.code : `inesperado: ${String(error)}`;
  }
  return 'nenhum erro';
}

describe('F0-08 catálogo de permissões', () => {
  it('registra e lista em ordem', () => {
    const catalog = new PermissionCatalog();
    catalog.register('projects', [
      { key: 'projects.sprint.close', description: 'Encerrar sprint' },
      { key: 'projects.project.create', description: 'Criar projeto' },
    ]);

    expect(catalog.keys()).toEqual(['projects.project.create', 'projects.sprint.close']);
    expect(catalog.has('projects.sprint.close')).toBe(true);
    expect(catalog.has('projects.sprint.reopen')).toBe(false);
  });

  it('recusa chave fora do formato modulo.recurso.acao', () => {
    const catalog = new PermissionCatalog();

    expect(
      codeOf(() => catalog.register('projects', [{ key: 'projects.sprint', description: 'x' }])),
    ).toBe('PERMISSION_KEY_INVALID');
    expect(
      codeOf(() =>
        catalog.register('projects', [{ key: 'Projects.Sprint.Close', description: 'x' }]),
      ),
    ).toBe('PERMISSION_KEY_INVALID');
  });

  it('recusa um módulo registrar permissão de outro', () => {
    const catalog = new PermissionCatalog();

    expect(
      codeOf(() =>
        catalog.register('projects', [{ key: 'partners.partner.create', description: 'x' }]),
      ),
    ).toBe('PERMISSION_KEY_WRONG_MODULE');
  });

  it('recusa registro duplicado', () => {
    const catalog = new PermissionCatalog();
    catalog.register('projects', [{ key: 'projects.sprint.close', description: 'x' }]);

    expect(
      codeOf(() =>
        catalog.register('projects', [{ key: 'projects.sprint.close', description: 'x' }]),
      ),
    ).toBe('PERMISSION_KEY_DUPLICATED');
  });

  it('Administrador recebe tudo; os demais, só o que declararam', () => {
    const catalog = new PermissionCatalog();
    catalog.register('projects', [
      { key: 'projects.project.read', description: 'Ver', defaultRoles: ['Leitor'] },
      { key: 'projects.project.create', description: 'Criar' },
    ]);

    expect(catalog.keysForRole(ADMINISTRATOR_ROLE, true)).toEqual([
      'projects.project.create',
      'projects.project.read',
    ]);
    expect(catalog.keysForRole('Leitor', false)).toEqual(['projects.project.read']);
    expect(catalog.keysForRole('Financeiro', false)).toEqual([]);
  });
});
