import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { loadWorkerEnv } from './env';
import { WorkerModule } from './worker.module';
import { WorkerService } from './worker.service';

async function bootstrap(): Promise<void> {
  loadDotenv({ quiet: true });
  const env = loadWorkerEnv();

  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  const worker = app.get(WorkerService);
  const status = worker.status(env.WORKER_NAME);
  console.error(`worker "${status.name}" iniciado (${status.state})`);
}

void bootstrap();
