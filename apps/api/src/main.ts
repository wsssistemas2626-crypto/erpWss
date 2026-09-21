import 'reflect-metadata';
import { loadApiEnv } from '@erp/platform-config';
import { ProblemDetailsFilter, setupOpenApi } from '@erp/platform-http';
import { IAM_ERROR_STATUS } from '@erp/platform-iam';
import { NestPinoLogger, createLogger } from '@erp/platform-observability';
import {
  paginationQuerySchema,
  problemDetailsSchema,
  versionedSchema,
} from '@erp/shared-contracts';
import { NestFactory } from '@nestjs/core';
import { API_GLOBAL_PREFIX } from './api-prefix';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const env = loadApiEnv();
  const logger = createLogger({ name: 'api', level: env.LOG_LEVEL });

  const app = await NestFactory.create(AppModule.forRoot(env), { bufferLogs: true });
  app.useLogger(new NestPinoLogger(logger));
  app.enableShutdownHooks();
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.useGlobalFilters(new ProblemDetailsFilter(logger, { statusByCode: IAM_ERROR_STATUS }));

  setupOpenApi(app, {
    title: 'ERP',
    description: 'API do ERP modular multi-tenant.',
    version: '1.0.0',
    schemas: {
      ProblemDetails: problemDetailsSchema,
      PaginationQuery: paginationQuerySchema,
      Versioned: versionedSchema,
    },
  });

  await app.listen(env.API_PORT);
  logger.info({ port: env.API_PORT, prefix: API_GLOBAL_PREFIX }, 'api no ar; OpenAPI em /api/docs');
}

void bootstrap();
