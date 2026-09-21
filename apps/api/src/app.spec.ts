import { startPostgresTestEnv, type PostgresTestEnv } from '@erp/platform-db/testing';
import { ProblemDetailsFilter, setupOpenApi } from '@erp/platform-http';
import { createLogger } from '@erp/platform-observability';
import { problemDetailsSchema } from '@erp/shared-contracts';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API_GLOBAL_PREFIX } from './api-prefix';
import { AppModule } from './app.module';

let env: PostgresTestEnv;
let app: INestApplication;
let baseUrl: string;

const discard = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

beforeAll(async () => {
  env = await startPostgresTestEnv();

  app = await NestFactory.create(
    AppModule.forRoot({
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
      API_PORT: 0,
      DATABASE_URL_APP: env.appUrl,
    }),
    { logger: false },
  );
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.useGlobalFilters(
    new ProblemDetailsFilter(createLogger({ name: 'test', level: 'fatal', destination: discard })),
  );
  setupOpenApi(app, {
    title: 'ERP',
    description: 'API do ERP modular multi-tenant.',
    version: '1.0.0',
    schemas: { ProblemDetails: problemDetailsSchema },
  });

  await app.listen(0);
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  await env?.stop();
});

describe('F0-06 composição da API', () => {
  it('serve /api/v1/health sem tocar em dependência nenhuma', async () => {
    const response = await fetch(`${baseUrl}/${API_GLOBAL_PREFIX}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('serve /api/v1/ready só quando o banco responde', async () => {
    const response = await fetch(`${baseUrl}/${API_GLOBAL_PREFIX}/ready`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready', checks: { database: 'ok' } });
  });

  it('devolve o correlationId no header de toda resposta', async () => {
    const response = await fetch(`${baseUrl}/${API_GLOBAL_PREFIX}/health`);

    expect(response.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('responde rota inexistente em problem+json', async () => {
    const response = await fetch(`${baseUrl}/${API_GLOBAL_PREFIX}/nao-existe`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(problemDetailsSchema.safeParse(body).success).toBe(true);
  });

  it('publica o OpenAPI em /api/docs, com os contratos zod como componentes', async () => {
    const response = await fetch(`${baseUrl}/api/docs-json`);
    const document = (await response.json()) as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };

    expect(response.status).toBe(200);
    expect(Object.keys(document.paths)).toContain(`/${API_GLOBAL_PREFIX}/health`);
    expect(document.components.schemas).toHaveProperty('ProblemDetails');
  });
});
