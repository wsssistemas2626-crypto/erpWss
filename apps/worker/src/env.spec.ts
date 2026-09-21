import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadWorkerEnv } from './env';

describe('F0-01 validação de ambiente do worker', () => {
  it('aceita um ambiente completo', () => {
    const env = loadWorkerEnv({ NODE_ENV: 'test', LOG_LEVEL: 'warn', WORKER_NAME: 'outbox' });

    expect(env).toEqual({ NODE_ENV: 'test', LOG_LEVEL: 'warn', WORKER_NAME: 'outbox' });
  });

  it('aplica os valores padrão de NODE_ENV e LOG_LEVEL', () => {
    const env = loadWorkerEnv({ WORKER_NAME: 'outbox' });

    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('falha com mensagem clara quando falta uma variável obrigatória', () => {
    expect(() => loadWorkerEnv({})).toThrow(EnvValidationError);
    expect(() => loadWorkerEnv({})).toThrow(/WORKER_NAME: variável ausente/);
  });
});
