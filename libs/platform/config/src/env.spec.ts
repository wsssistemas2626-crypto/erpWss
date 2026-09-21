import { describe, expect, it } from 'vitest';
import { EnvValidationError } from './env';
import { loadApiEnv, loadWorkerEnv } from './app-env';

const DATABASE_URL = 'postgres://app_user:app_user@localhost:5432/erp';
const PLATFORM_URL = 'postgres://app_platform:app_platform@localhost:5432/erp';
const CLERK = {
  CLERK_JWT_KEY: '-----BEGIN PUBLIC KEY-----abc-----END PUBLIC KEY-----',
  CLERK_SECRET_KEY: 'sk_test_abc',
  CLERK_AUTHORIZED_PARTIES: 'http://localhost:5173, http://localhost:4200',
  CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_abc',
};
const CLERK_ESPERADO = {
  CLERK_JWT_KEY: CLERK.CLERK_JWT_KEY,
  CLERK_SECRET_KEY: CLERK.CLERK_SECRET_KEY,
  CLERK_WEBHOOK_SIGNING_SECRET: CLERK.CLERK_WEBHOOK_SIGNING_SECRET,
  CLERK_AUTHORIZED_PARTIES: ['http://localhost:5173', 'http://localhost:4200'],
};

describe('F0-06 variáveis de ambiente da api', () => {
  it('aceita um ambiente completo e converte a porta para número', () => {
    const env = loadApiEnv({
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
      API_PORT: '3000',
      DATABASE_URL_APP: DATABASE_URL,
      DATABASE_URL_PLATFORM: PLATFORM_URL,
      ...CLERK,
    });

    expect(env).toEqual({
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
      API_PORT: 3000,
      DATABASE_URL_APP: DATABASE_URL,
      DATABASE_URL_PLATFORM: PLATFORM_URL,
      ...CLERK_ESPERADO,
    });
  });

  it('quebra CLERK_AUTHORIZED_PARTIES em lista, sem espaços sobrando', () => {
    const env = loadApiEnv({
      API_PORT: '3000',
      DATABASE_URL_APP: DATABASE_URL,
      DATABASE_URL_PLATFORM: PLATFORM_URL,
      ...CLERK,
    });

    expect(env.CLERK_AUTHORIZED_PARTIES).toEqual([
      'http://localhost:5173',
      'http://localhost:4200',
    ]);
  });

  it('aplica os padrões de NODE_ENV e LOG_LEVEL', () => {
    const env = loadApiEnv({
      API_PORT: '3000',
      DATABASE_URL_APP: DATABASE_URL,
      DATABASE_URL_PLATFORM: PLATFORM_URL,
      ...CLERK,
    });

    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('falha listando todas as variáveis que faltam', () => {
    try {
      loadApiEnv({});
      throw new Error('deveria ter falhado');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as EnvValidationError).issues).toEqual([
        'API_PORT: variável ausente',
        'DATABASE_URL_APP: variável ausente',
        'DATABASE_URL_PLATFORM: variável ausente',
        'CLERK_JWT_KEY: variável ausente',
        'CLERK_SECRET_KEY: variável ausente',
        'CLERK_AUTHORIZED_PARTIES: variável ausente',
        'CLERK_WEBHOOK_SIGNING_SECRET: variável ausente',
      ]);
      expect((error as Error).message).toContain('.env.example');
    }
  });

  it('recusa porta fora da faixa e nível de log desconhecido', () => {
    expect(() =>
      loadApiEnv({ API_PORT: '70000', DATABASE_URL_APP: DATABASE_URL, ...CLERK }),
    ).toThrow(EnvValidationError);
    expect(() =>
      loadApiEnv({
        API_PORT: '3000',
        DATABASE_URL_APP: DATABASE_URL,
        ...CLERK,
        LOG_LEVEL: 'verboso',
      }),
    ).toThrow(EnvValidationError);
  });
});

describe('F0-06 variáveis de ambiente do worker', () => {
  it('aceita um ambiente completo', () => {
    expect(
      loadWorkerEnv({
        WORKER_NAME: 'outbox',
        DATABASE_URL_APP: DATABASE_URL,
        DATABASE_URL_PLATFORM: DATABASE_URL,
      }),
    ).toEqual({
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      WORKER_NAME: 'outbox',
      DATABASE_URL_APP: DATABASE_URL,
      DATABASE_URL_PLATFORM: DATABASE_URL,
      OUTBOX_POLL_INTERVAL_MS: 1000,
    });
  });

  it('falha com mensagem clara quando falta o nome do worker', () => {
    expect(() => loadWorkerEnv({})).toThrow(/WORKER_NAME: variável ausente/);
  });
});
