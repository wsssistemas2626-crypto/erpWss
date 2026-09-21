import type { ComponentType } from 'react';
import type { AppTranslations } from '../i18n/pt-BR';

/** Rótulos disponíveis para itens de menu, garantidos pelo arquivo de tradução. */
export type MenuLabelKey = keyof AppTranslations['menu'];

/**
 * Item do menu lateral.
 *
 * Um item só aparece quando o módulo dono está habilitado no tenant **e** o usuário tem
 * alguma das permissões exigidas — as duas listas vêm de `GET /api/v1/me` (F0-13).
 * Item sem `anyOfPermissions` depende só do módulo (ex.: a tela inicial).
 */
export interface MenuItem {
  /** Sufixo da chave i18n do rótulo: `menu.<labelKey>`. */
  readonly labelKey: MenuLabelKey;
  readonly to: string;
  /** Módulo dono, como registrado no `ModuleCatalog` do backend. */
  readonly module: string;
  readonly anyOfPermissions?: readonly string[];
  readonly icon?: ComponentType<{ className?: string }>;
}

/** O recorte de `GET /api/v1/me` que decide o que o usuário enxerga. */
export interface MenuAccess {
  readonly modules: readonly string[];
  readonly permissions: readonly string[];
}

export function canSeeMenuItem(item: MenuItem, access: MenuAccess): boolean {
  if (!access.modules.includes(item.module)) {
    return false;
  }
  if (item.anyOfPermissions === undefined || item.anyOfPermissions.length === 0) {
    return true;
  }
  return item.anyOfPermissions.some((permission) => access.permissions.includes(permission));
}

export function visibleMenuItems(
  items: readonly MenuItem[],
  access: MenuAccess,
): readonly MenuItem[] {
  return items.filter((item) => canSeeMenuItem(item, access));
}
