import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadApiEnv } from './env';

describe('F0-01 validação de ambiente da api', () => {
  it('aceita um ambiente completo e converte a porta para numero', () => {
    const env = loadApiEnv({ NODE_ENV: 'test', LOG_LEVEL: 'debug', API_PORT: '3000' });

    expect(env).toEqual({ NODE_ENV: 'test', LOG_LEVEL: 'debug', API_PORT: 3000 });
  });

  it('aplica os valores padrão de NODE_ENV e LOG_LEVEL', () => {
    const env = loadApiEnv({ API_PORT: '3000' });

    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('falha com mensagem clara quando falta uma variável obrigatória', () => {
    expect(() => loadApiEnv({})).toThrow(EnvValidationError);
    expect(() => loadApiEnv({})).toThrow(/API_PORT: variável ausente/);
  });

  it('falha quando a porta está fora da faixa válida', () => {
    expect(() => loadApiEnv({ API_PORT: '70000' })).toThrow(/API_PORT/);
  });
});
