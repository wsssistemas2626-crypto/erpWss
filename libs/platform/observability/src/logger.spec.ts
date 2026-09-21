import { runInTenantContext } from '@erp/platform-tenancy';
import { newId } from '@erp/shared-kernel';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runWithLogContext } from './log-context';
import { createLogger } from './logger';
import { REDACTED, scrubSensitiveText } from './redaction';

/** Captura as linhas JSON que o pino escreve. */
function captureLogger() {
  const lines: Record<string, unknown>[] = [];
  const raw: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      const text = chunk.toString('utf8');
      raw.push(text);
      for (const line of text.split('\n').filter(Boolean)) {
        lines.push(JSON.parse(line) as Record<string, unknown>);
      }
      callback();
    },
  });
  return {
    logger: createLogger({ name: 'test', level: 'trace', destination: stream }),
    lines,
    raw,
  };
}

describe('F0-06 redação de dados sensíveis no log (RNF022)', () => {
  it('não deixa passar o header Authorization nem o token', () => {
    const { logger, raw } = captureLogger();

    logger.info(
      {
        req: {
          method: 'GET',
          url: '/api/v1/projects',
          headers: {
            authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.segredo',
            'user-agent': 'vitest',
          },
        },
        token: 'sess_2abcdefghijklmnop',
      },
      'requisição autenticada',
    );

    const texto = raw.join('');
    expect(texto).not.toContain('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(texto).not.toContain('sess_2abcdefghijklmnop');
    expect(texto).toContain(REDACTED);
    // o que não é sensível continua no log, senão o log perde a serventia
    expect(texto).toContain('/api/v1/projects');
    expect(texto).toContain('vitest');
  });

  it('apaga senha, segredo e documentos em qualquer nível do objeto', () => {
    const { logger, raw } = captureLogger();

    logger.info({
      password: 'nao-deveria-aparecer',
      user: { email: 'pessoa@example.com', cpf: '529.982.247-25' },
      tenant: { company: { cnpj: '11.222.333/0001-81' } },
    });

    const texto = raw.join('');
    expect(texto).not.toContain('nao-deveria-aparecer');
    expect(texto).not.toContain('pessoa@example.com');
    expect(texto).not.toContain('529.982.247-25');
    expect(texto).not.toContain('11.222.333/0001-81');
  });

  it('mascara CPF, CNPJ e e-mail no meio da mensagem de texto', () => {
    const { logger, raw } = captureLogger();

    logger.warn('falha ao sincronizar 529.982.247-25 e 11.222.333/0001-81 de pessoa@example.com');

    const texto = raw.join('');
    expect(texto).not.toContain('529.982.247-25');
    expect(texto).not.toContain('11.222.333/0001-81');
    expect(texto).not.toContain('pessoa@example.com');
    // o domínio fica: ajuda a diagnosticar e não identifica ninguém sozinho
    expect(texto).toContain('***@example.com');
  });

  it('scrubSensitiveText preserva o texto que não é sensível', () => {
    expect(scrubSensitiveText('projeto ACME criado')).toBe('projeto ACME criado');
    expect(scrubSensitiveText('cpf 52998224725 aqui')).toBe(`cpf ${REDACTED} aqui`);
  });
});

describe('F0-06 contexto no log (RNF033)', () => {
  it('toda linha carrega correlationId e tenantId quando existem', () => {
    const { logger, lines } = captureLogger();
    const tenantId = newId();

    runWithLogContext({ correlationId: 'corr-1', userId: 'user-1' }, () => {
      runInTenantContext({ tenantId }, () => {
        logger.info('dentro do contexto');
      });
    });
    logger.info('fora do contexto');

    expect(lines[0]).toMatchObject({ correlationId: 'corr-1', userId: 'user-1', tenantId });
    expect(lines[1]).not.toHaveProperty('correlationId');
    expect(lines[1]).not.toHaveProperty('tenantId');
  });

  it('escreve JSON estruturado, com nível legível e hora em ISO', () => {
    const { logger, lines } = captureLogger();

    logger.warn('atenção');

    expect(lines[0]).toMatchObject({ level: 'warn', name: 'test', msg: 'atenção' });
    expect(String(lines[0]?.time)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
