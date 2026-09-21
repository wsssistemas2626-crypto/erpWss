import { DomainError } from '@erp/shared-kernel';

/**
 * Catálogo dos módulos que esta instalação oferece.
 *
 * Mesma ideia do `PermissionCatalog`: cada módulo se declara na composição da aplicação,
 * e não numa lista central mantida à mão. O front usa o resultado para montar o menu —
 * um módulo que não está aqui não tem item de menu nem rota (docs/dominio/platform.md).
 */

export const MODULE_KEY = /^[a-z][a-z0-9-]*$/;

export interface ModuleDefinition {
  /** Código do módulo, ex.: `projects` (CLAUDE.md §5: código em inglês). */
  readonly key: string;
  /** Texto em pt-BR para a tela de configuração de módulos do tenant. */
  readonly description: string;
}

export class ModuleCatalog {
  private readonly byKey = new Map<string, ModuleDefinition>();

  register(modules: readonly ModuleDefinition[]): void {
    for (const module of modules) {
      if (!MODULE_KEY.test(module.key)) {
        throw new DomainError(
          'MODULE_KEY_INVALID',
          `Módulo "${module.key}" fora do formato esperado.`,
          { key: module.key },
        );
      }
      if (this.byKey.has(module.key)) {
        throw new DomainError(
          'MODULE_KEY_DUPLICATED',
          `O módulo "${module.key}" foi registrado duas vezes.`,
          { key: module.key },
        );
      }
      this.byKey.set(module.key, module);
    }
  }

  all(): readonly ModuleDefinition[] {
    return [...this.byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
  }

  keys(): readonly string[] {
    return this.all().map((module) => module.key);
  }

  has(key: string): boolean {
    return this.byKey.has(key);
  }
}

export const MODULE_CATALOG = Symbol('MODULE_CATALOG');
