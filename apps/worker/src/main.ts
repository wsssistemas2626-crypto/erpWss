import 'reflect-metadata';
import { loadWorkerEnv } from '@erp/platform-config';
import { NestPinoLogger, createLogger } from '@erp/platform-observability';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { WorkerService } from './worker.service';

async function bootstrap(): Promise<void> {
  const env = loadWorkerEnv();
  const logger = createLogger({ name: 'worker', level: env.LOG_LEVEL });

  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(new NestPinoLogger(logger));
  app.enableShutdownHooks();

  const status = app.get(WorkerService).status(env.WORKER_NAME);
  logger.info({ worker: status.name, state: status.state }, 'worker iniciado');
}

void bootstrap();
