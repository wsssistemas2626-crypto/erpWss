import { config as loadDotenv } from 'dotenv';
import type { z } from 'zod';

/**
 * Carregamento e validação das variáveis de ambiente.
 *
 * Processo que sobe sem uma variável obrigatória falha na primeira requisição, num
 * lugar distante da causa. Aqui ele falha no boot, dizendo exatamente o que falta.
 */
export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(
      [
        'Configuração inválida: o processo não pode iniciar.',
        ...issues.map((issue) => `  - ${issue}`),
        'Copie o .env.example para .env na raiz do repositório e preencha os valores.',
      ].join('\n'),
    );
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

let dotenvLoaded = false;

/** Lê o `.env` da raiz do repositório. Chamar mais de uma vez não custa nada. */
export function loadDotenvOnce(): void {
  if (dotenvLoaded) {
    return;
  }
  loadDotenv({ quiet: true });
  dotenvLoaded = true;
}

export function loadEnv<T>(schema: z.ZodType<T>, source: NodeJS.ProcessEnv = process.env): T {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  throw new EnvValidationError(formatIssues(result.error));
}

function formatIssues(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const name = issue.path.map(String).join('.');
    const reason =
      issue.code === 'invalid_type' && issue.input === undefined
        ? 'variável ausente'
        : issue.message;
    return `${name}: ${reason}`;
  });
}
