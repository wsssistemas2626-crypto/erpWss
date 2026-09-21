import { describe, expect, it } from 'vitest';
import { canSeeMenuItem, visibleMenuItems, type MenuItem } from './menu';

const INICIO: MenuItem = { labelKey: 'home', to: '/', module: 'platform' };
const PROJETOS: MenuItem = {
  labelKey: 'projects',
  to: '/projetos',
  module: 'projects',
  anyOfPermissions: ['projects.project.read'],
};
const PAPEIS: MenuItem = {
  labelKey: 'roles',
  to: '/papeis',
  module: 'platform',
  anyOfPermissions: ['platform.role.read'],
};

describe('F0-13 menu por permissão', () => {
  it('esconde o item quando o usuário não tem nenhuma permissão do módulo', () => {
    const visiveis = visibleMenuItems([INICIO, PROJETOS], {
      modules: ['platform', 'projects'],
      permissions: [],
    });

    expect(visiveis.map((item) => item.labelKey)).toEqual(['home']);
  });

  it('mostra o item quando o usuário tem ao menos uma das permissões exigidas', () => {
    expect(
      canSeeMenuItem(PROJETOS, {
        modules: ['projects'],
        permissions: ['projects.project.read'],
      }),
    ).toBe(true);
  });

  it('esconde o item quando o módulo está desabilitado, mesmo com a permissão', () => {
    expect(
      canSeeMenuItem(PROJETOS, { modules: ['platform'], permissions: ['projects.project.read'] }),
    ).toBe(false);
  });

  it('item sem permissão exigida depende apenas do módulo habilitado', () => {
    expect(canSeeMenuItem(INICIO, { modules: ['platform'], permissions: [] })).toBe(true);
    expect(canSeeMenuItem(INICIO, { modules: [], permissions: [] })).toBe(false);
  });

  it('preserva a ordem declarada dos itens visíveis', () => {
    const visiveis = visibleMenuItems([INICIO, PROJETOS, PAPEIS], {
      modules: ['platform', 'projects'],
      permissions: ['projects.project.read', 'platform.role.read'],
    });

    expect(visiveis.map((item) => item.labelKey)).toEqual(['home', 'projects', 'roles']);
  });
});
