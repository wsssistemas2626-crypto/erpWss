import { createHash } from 'node:crypto';

export const PII_PREFIX = 'pii:';

/**
 * Mascaramento de PII na auditoria.
 *
 * O valor vira um resumo curto do sha256, e não um `[REDACTED]` fixo: assim a trilha
 * continua respondendo "mudou?" — que é a pergunta que a auditoria existe para responder —
 * sem guardar o dado pessoal. Dois resumos iguais significam valor igual; diferentes,
 * valor alterado.
 */
export function maskValue(value: unknown): string {
  if (value === null || value === undefined) {
    return `${PII_PREFIX}null`;
  }
  const digest = createHash('sha256').update(JSON.stringify(value)).digest('hex');
  return `${PII_PREFIX}${digest.slice(0, 12)}`;
}

/** Aplica o mascaramento aos campos indicados, em qualquer profundidade do objeto. */
export function maskPii(
  snapshot: Record<string, unknown> | null | undefined,
  piiFields: ReadonlySet<string>,
): Record<string, unknown> | null {
  if (snapshot === null || snapshot === undefined) {
    return null;
  }
  return maskObject(snapshot, piiFields);
}

function maskObject(
  source: Record<string, unknown>,
  piiFields: ReadonlySet<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    result[key] = piiFields.has(key) ? maskValue(value) : maskNested(value, piiFields);
  }
  return result;
}

function maskNested(value: unknown, piiFields: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskNested(item, piiFields));
  }
  if (typeof value === 'object' && value !== null) {
    return maskObject(value as Record<string, unknown>, piiFields);
  }
  return value;
}
