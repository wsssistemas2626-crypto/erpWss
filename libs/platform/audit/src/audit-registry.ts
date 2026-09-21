/**
 * Campos que nunca entram em claro na trilha de auditoria (CLAUDE.md §4.5, RNF022).
 *
 * Dois níveis: uma lista fixa de nomes que são PII em qualquer entidade, e o que cada
 * módulo declara para as suas entidades — é o inventário do RNF020 virando código.
 */
export const DEFAULT_PII_FIELDS: readonly string[] = [
  'email',
  'emailAddress',
  'cpf',
  'cnpj',
  'document',
  'phone',
  'phoneNumber',
  'birthDate',
  'address',
  'password',
  'token',
];

export interface AuditedEntityDefinition {
  readonly module: string;
  readonly entity: string;
  /** Campos PII específicos desta entidade, além dos nomes sempre mascarados. */
  readonly piiFields: readonly string[];
}

export class AuditRegistry {
  private readonly byEntity = new Map<string, ReadonlySet<string>>();

  register(definitions: readonly AuditedEntityDefinition[]): void {
    for (const definition of definitions) {
      this.byEntity.set(`${definition.module}.${definition.entity}`, new Set(definition.piiFields));
    }
  }

  piiFieldsOf(module: string, entity: string): ReadonlySet<string> {
    const declared = this.byEntity.get(`${module}.${entity}`) ?? new Set<string>();
    return new Set([...DEFAULT_PII_FIELDS, ...declared]);
  }
}

export const AUDIT_REGISTRY = Symbol('AUDIT_REGISTRY');
