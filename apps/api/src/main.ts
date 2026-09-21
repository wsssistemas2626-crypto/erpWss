import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadApiEnv } from './env';

export const API_GLOBAL_PREFIX = 'api/v1';

async function bootstrap(): Promise<void> {
  loadDotenv({ quiet: true });
  const env = loadApiEnv();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  await app.listen(env.API_PORT);
  console.error(`api ouvindo em http://localhost:${env.API_PORT}/${API_GLOBAL_PREFIX}`);
}

void bootstrap();
