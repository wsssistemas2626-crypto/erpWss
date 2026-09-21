import { z } from 'zod';

/**
 * Variaveis de ambiente exigidas pela API. Validadas no boot: sem elas o processo
 * não sobe. Cada item do backlog que precisar de uma variável nova a acrescenta aqui.
 */
export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_PORT: z.coerce.number().int().min(1).max(65535),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export class EnvValidationError extends Error {
  constructor(issues: readonly string[]) {
    super(
      [
        'Configuração inválida: o processo não pode iniciar.',
        ...issues.map((issue) => `  - ${issue}`),
        'Copie o .env.example para .env na raiz do repositório e preencha os valores.',
      ].join('\n'),
    );
    this.name = 'EnvValidationError';
  }
}

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = apiEnvSchema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  throw new EnvValidationError(formatIssues(result.error));
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const name = issue.path.join('.');
    const reason =
      issue.code === 'invalid_type' && issue.input === undefined
        ? 'variável ausente'
        : issue.message;
    return `${name}: ${reason}`;
  });
}
