/**
 * Redação de dados sensíveis no log (RNF022 e CLAUDE.md §4.5).
 *
 * Duas camadas, porque uma só não basta:
 *  1. por chave — o `redact` do pino apaga campos com nome conhecido, em qualquer nível;
 *  2. por padrão — CPF, CNPJ e e-mail são mascarados mesmo quando aparecem no meio de
 *     uma mensagem de texto, onde nenhuma regra por chave alcançaria.
 */

export const REDACTED = '[REDACTED]';

/** Campos apagados pelo `redact` do pino, na raiz e em qualquer objeto aninhado. */
const SENSITIVE_KEYS = [
  'password',
  'senha',
  'token',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'clientSecret',
  'signature',
  'cpf',
  'cnpj',
  'document',
  'email',
  'emailAddress',
];

export const REDACT_PATHS: readonly string[] = [
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((key) => `*.${key}`),
  ...SENSITIVE_KEYS.map((key) => `*.*.${key}`),
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CNPJ_PATTERN = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const EMAIL_PATTERN = /\b[\w.+-]+@([\w-]+\.[\w.-]+)\b/g;

/**
 * Mascara CPF, CNPJ e e-mail dentro de um texto. O domínio do e-mail é preservado:
 * é o que costuma importar para diagnóstico e não identifica ninguém sozinho.
 */
export function scrubSensitiveText(text: string): string {
  return text
    .replace(CNPJ_PATTERN, REDACTED)
    .replace(CPF_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, (_match, domain: string) => `***@${domain}`);
}
