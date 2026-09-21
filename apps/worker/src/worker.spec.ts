import { startPostgresTestEnv, type PostgresTestEnv } from '@erp/platform-db/testing';
import { createLogger } from '@erp/platform-observability';
import { OutboxPublisher, OutboxWriter } from '@erp/platform-outbox';
import { InMemoryEventBus } from '@erp/platform-outbox/testing';
import { runInTenantContext, TenantDb } from '@erp/platform-tenancy';
import { newId } from '@erp/shared-kernel';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WorkerModule } from './worker.module';
import { WorkerService } from './worker.service';

let env: PostgresTestEnv;
let context: INestApplicationContext;
let worker: WorkerService;
let bus: InMemoryEventBus;

const tenantId = newId();
const discard = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});
const logger = createLogger({ name: 'test', level: 'fatal', destination: discard });

beforeAll(async () => {
  env = await startPostgresTestEnv();
  await env.ownerPool.query(
    `insert into platform.tenants (id, clerk_org_id, name, slug) values ($1, 'org_w', 'W', 'w')`,
    [tenantId],
  );

  bus = new InMemoryEventBus();
  const publisher = new OutboxPublisher(env.platformPool, bus, logger, { pollIntervalMs: 100 });

  context = await NestFactory.createApplicationContext(
    WorkerModule.forRoot({
      env: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'fatal',
        WORKER_NAME: 'outbox',
        DATABASE_URL_APP: env.appUrl,
        DATABASE_URL_PLATFORM: env.platformUrl,
        OUTBOX_POLL_INTERVAL_MS: 100,
      },
      logger,
      bus,
      publisher,
    }),
    { logger: false },
  );
  worker = context.get(WorkerService);
});

afterAll(async () => {
  await worker?.stop();
  await context?.close();
  await env?.stop();
});

describe('F0-10 worker', () => {
  it('sobe ocioso, sem consumidores registrados ainda', () => {
    expect(worker.status('outbox')).toEqual({
      name: 'outbox',
      state: 'idle',
      consumers: [],
    });
  });

  it('ao iniciar, drena a outbox sozinho', async () => {
    const tenantDb = new TenantDb(env.appPool);
    await runInTenantContext({ tenantId }, () =>
      tenantDb.withTenantTx((tx) =>
        new OutboxWriter().append(tx, {
          type: 'projects.project.created.v1',
          payload: { projectId: newId() },
        }),
      ),
    );

    await worker.start();
    expect(worker.status('outbox').state).toBe('running');

    await vi.waitFor(() => {
      expect(bus.published).toHaveLength(1);
    });
  });

  it('parar é idempotente e deixa o estado explícito', async () => {
    await worker.stop();

    expect(worker.status('outbox').state).toBe('stopped');
    await expect(worker.stop()).resolves.toBeUndefined();
  });
});
