import 'reflect-metadata';
import { loadWorkerEnv } from '@erp/platform-config';
import { createDbPool } from '@erp/platform-db';
import { NestPinoLogger, createLogger } from '@erp/platform-observability';
import { OutboxPublisher, PgBossEventBus } from '@erp/platform-outbox';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { WorkerService } from './worker.service';

async function bootstrap(): Promise<void> {
  const env = loadWorkerEnv();
  const logger = createLogger({ name: 'worker', level: env.LOG_LEVEL });

  const platformPool = createDbPool(env.DATABASE_URL_PLATFORM, {
    applicationName: 'erp-worker-platform',
  });
  const bus = new PgBossEventBus({ connectionString: env.DATABASE_URL_PLATFORM }, logger);
  const publisher = new OutboxPublisher(platformPool, bus, logger, {
    pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
  });

  const app = await NestFactory.createApplicationContext(
    WorkerModule.forRoot({ env, logger, bus, publisher }),
    { bufferLogs: true },
  );
  app.useLogger(new NestPinoLogger(logger));
  app.enableShutdownHooks();

  const worker = app.get(WorkerService);
  await worker.start();
  logger.info({ worker: env.WORKER_NAME }, 'worker iniciado');

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'encerrando o worker');
    void worker
      .stop()
      .then(() => platformPool.end())
      .then(() => app.close())
      .catch((error: unknown) => {
        logger.error({ err: error }, 'falha ao encerrar o worker');
      });
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}

void bootstrap();
