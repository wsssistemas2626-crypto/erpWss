import { createLogger } from '@erp/platform-observability';
import { withVersion } from '@erp/shared-contracts';
import {
  CONCURRENCY_CONFLICT,
  DomainError,
  ENTITY_NOT_FOUND,
  FORBIDDEN,
  ForbiddenError,
  NotFoundError,
  VALIDATION_ERROR,
  assertVersion,
} from '@erp/shared-kernel';
import { Body, Controller, Get, Module, Patch, Post, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CORRELATION_ID_HEADER, CorrelationIdMiddleware } from './correlation-id.middleware';
import { ProblemDetailsFilter } from './problem-details.filter';
import { zodPipe } from './zod-validation.pipe';

const createItemSchema = z.object({
  name: z.string().min(3),
  quantity: z.number().int().positive(),
});

const updateItemSchema = withVersion(z.object({ name: z.string().min(3) }));

/** A entidade está na versão 3; qualquer outra versão enviada é conflito. */
const CURRENT_VERSION = 3;

@Controller()
class TestController {
  @Post('items')
  create(@Body(zodPipe(createItemSchema)) body: z.infer<typeof createItemSchema>) {
    return body;
  }

  @Patch('items')
  update(@Body(zodPipe(updateItemSchema)) body: z.infer<typeof updateItemSchema>) {
    assertVersion('Item', body.version, CURRENT_VERSION);
    return { updated: true };
  }

  @Get('missing')
  missing(): never {
    throw new NotFoundError('Item', 'abc');
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenError();
  }

  @Get('rule')
  rule(): never {
    throw new DomainError('SPRINT_ALREADY_CLOSED', 'A sprint já foi encerrada.');
  }

  @Get('boom')
  boom(): never {
    throw new Error('segredo interno que não pode vazar para o cliente');
  }
}

@Module({ controllers: [TestController] })
class TestModule {
  configure(consumer: { apply: (m: unknown) => { forRoutes: (r: string) => void } }): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('{*splat}');
  }
}

let app: INestApplication;
let baseUrl: string;

/** Descarta o log: o filtro loga, e o teste não precisa ver isso. */
const discard = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

beforeAll(async () => {
  app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalFilters(
    new ProblemDetailsFilter(createLogger({ name: 'test', level: 'fatal', destination: discard })),
  );
  await app.listen(0);
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
});

async function request(
  path: string,
  init?: RequestInit,
): Promise<{
  status: number;
  contentType: string | null;
  body: Record<string, unknown>;
  headers: Headers;
}> {
  const response = await fetch(`${baseUrl}${path}`, init);
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    body: (await response.json()) as Record<string, unknown>,
    headers: response.headers,
  };
}

function postJson(
  path: string,
  payload: unknown,
): Promise<ReturnType<typeof request> extends Promise<infer T> ? T : never> {
  return request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('F0-06 validação de entrada', () => {
  it('corpo inválido vira 400 problem+json com code VALIDATION_ERROR e os campos', async () => {
    const response = await postJson('/items', { name: 'ab', quantity: -1 });

    expect(response.status).toBe(400);
    expect(response.contentType).toContain('application/problem+json');
    expect(response.body.code).toBe(VALIDATION_ERROR);
    expect(response.body.status).toBe(400);

    const errors = response.body.errors as readonly { path: string }[];
    expect(errors.map((issue) => issue.path).sort()).toEqual(['name', 'quantity']);
  });

  it('corpo válido passa e chega tipado no controller', async () => {
    const response = await postJson('/items', { name: 'Caneta', quantity: 3 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ name: 'Caneta', quantity: 3 });
  });
});

describe('F0-06 concorrência otimista', () => {
  it('versão divergente vira 409 com code CONCURRENCY_CONFLICT', async () => {
    const response = await request('/items', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Caneta', version: 2 }),
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe(CONCURRENCY_CONFLICT);
    expect(response.contentType).toContain('application/problem+json');
  });

  it('versão correta passa', async () => {
    const response = await request('/items', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Caneta', version: CURRENT_VERSION }),
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updated: true });
  });
});

describe('F0-06 mapeamento de erros para problem+json', () => {
  it('entidade inexistente vira 404', async () => {
    const response = await request('/missing');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe(ENTITY_NOT_FOUND);
  });

  it('acesso negado vira 403', async () => {
    const response = await request('/forbidden');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(FORBIDDEN);
  });

  it('regra de negócio sem status próprio vira 422, preservando o code do domínio', async () => {
    const response = await request('/rule');

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('SPRINT_ALREADY_CLOSED');
  });

  it('rota inexistente vira 404 em problem+json', async () => {
    const response = await request('/nao-existe');

    expect(response.status).toBe(404);
    expect(response.contentType).toContain('application/problem+json');
  });

  it('erro inesperado vira 500 sem vazar a mensagem interna', async () => {
    const response = await request('/boom');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('segredo interno');
  });
});

describe('F0-06 correlação', () => {
  it('gera um correlationId quando o cliente não manda', async () => {
    const response = await request('/health-inexistente');

    expect(response.headers.get(CORRELATION_ID_HEADER)).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body.correlationId).toBe(response.headers.get(CORRELATION_ID_HEADER));
  });

  it('respeita o correlationId que o cliente manda', async () => {
    const response = await request('/missing', {
      headers: { [CORRELATION_ID_HEADER]: 'corr-do-cliente' },
    });

    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe('corr-do-cliente');
    expect(response.body.correlationId).toBe('corr-do-cliente');
  });
});
