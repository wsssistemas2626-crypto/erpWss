import { DomainError } from '@erp/shared-kernel';

/**
 * Catálogo de permissões (CLAUDE.md §5: `<modulo>.<recurso>.<acao>`).
 *
 * Cada módulo declara as suas na composição da aplicação. O catálogo serve para dois
 * propósitos: semear os papéis padrão de um tenant novo e permitir que a UI liste o que
 * existe para configurar — sem ninguém precisar manter uma lista central à mão.
 */

export const PERMISSION_KEY = /^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/;

export interface PermissionDefinition {
  /** `projects.sprint.close`. */
  readonly key: string;
  /** Texto em pt-BR para a tela de configuração de papéis. */
  readonly description: string;
  /**
   * Papéis do sistema que já nascem com esta permissão. `Administrador` recebe tudo,
   * então não precisa ser listado.
   */
  readonly defaultRoles?: readonly string[];
}

export class PermissionCatalog {
  private readonly byKey = new Map<string, PermissionDefinition>();

  register(module: string, permissions: readonly PermissionDefinition[]): void {
    for (const permission of permissions) {
      if (!PERMISSION_KEY.test(permission.key)) {
        throw new DomainError(
          'PERMISSION_KEY_INVALID',
          `Permissão "${permission.key}" fora do formato <modulo>.<recurso>.<acao>.`,
          { key: permission.key },
        );
      }
      if (!permission.key.startsWith(`${module}.`)) {
        throw new DomainError(
          'PERMISSION_KEY_WRONG_MODULE',
          `O módulo ${module} não pode registrar a permissão "${permission.key}".`,
          { module, key: permission.key },
        );
      }
      const existing = this.byKey.get(permission.key);
      if (existing !== undefined) {
        throw new DomainError(
          'PERMISSION_KEY_DUPLICATED',
          `A permissão "${permission.key}" foi registrada duas vezes.`,
          { key: permission.key },
        );
      }
      this.byKey.set(permission.key, permission);
    }
  }

  all(): readonly PermissionDefinition[] {
    return [...this.byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
  }

  keys(): readonly string[] {
    return this.all().map((permission) => permission.key);
  }

  has(key: string): boolean {
    return this.byKey.has(key);
  }

  /** Permissões que um papel do sistema recebe ao ser semeado. */
  keysForRole(roleName: string, isAdministrator: boolean): readonly string[] {
    if (isAdministrator) {
      return this.keys();
    }
    return this.all()
      .filter((permission) => permission.defaultRoles?.includes(roleName) === true)
      .map((permission) => permission.key);
  }
}

export const PERMISSION_CATALOG = Symbol('PERMISSION_CATALOG');
