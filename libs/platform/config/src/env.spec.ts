import { describe, expect, it } from 'vitest';
import { EnvValidationError } from './env';
import { loadApiEnv, loadWorkerEnv } from './app-env';

const DATABASE_URL = 'postgres://app_user:app_user@localhost:5432/erp';

describe('F0-06 variáveis de ambiente da api', () => {
  it('aceita um ambiente completo e converte a porta para número', () => {
    const env = loadApiEnv({
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
      API_PORT: '3000',
      DATABASE_URL_APP: DATABASE_URL,
    });

    expect(env).toEqual({
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
      API_PORT: 3000,
      DATABASE_URL_APP: DATABASE_URL,
    });
  });

  it('aplica os padrões de NODE_ENV e LOG_LEVEL', () => {
    const env = loadApiEnv({ API_PORT: '3000', DATABASE_URL_APP: DATABASE_URL });

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
      ]);
      expect((error as Error).message).toContain('.env.example');
    }
  });

  it('recusa porta fora da faixa e nível de log desconhecido', () => {
    expect(() => loadApiEnv({ API_PORT: '70000', DATABASE_URL_APP: DATABASE_URL })).toThrow(
      EnvValidationError,
    );
    expect(() =>
      loadApiEnv({ API_PORT: '3000', DATABASE_URL_APP: DATABASE_URL, LOG_LEVEL: 'verboso' }),
    ).toThrow(EnvValidationError);
  });
});

describe('F0-06 variáveis de ambiente do worker', () => {
  it('aceita um ambiente completo', () => {
    expect(loadWorkerEnv({ WORKER_NAME: 'outbox' })).toEqual({
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      WORKER_NAME: 'outbox',
    });
  });

  it('falha com mensagem clara quando falta o nome do worker', () => {
    expect(() => loadWorkerEnv({})).toThrow(/WORKER_NAME: variável ausente/);
  });
});
