import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { z } from 'zod';

export const OPENAPI_PATH = 'api/docs';

export interface OpenApiOptions {
  readonly title: string;
  readonly description: string;
  readonly version: string;
  /** Schemas zod compartilhados publicados como componentes reutilizáveis. */
  readonly schemas?: Readonly<Record<string, z.ZodType>>;
}

/**
 * OpenAPI gerado automaticamente (CLAUDE.md §5), servido em `/api/docs`.
 *
 * Os schemas de `@erp/shared-contracts` entram como componentes via
 * `z.toJSONSchema()` — nativo do zod 4 —, então o contrato publicado é literalmente
 * o mesmo objeto que valida a requisição.
 */
export function setupOpenApi(app: INestApplication, options: OpenApiOptions): void {
  const config = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(options.description)
    .setVersion(options.version)
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const schemas = options.schemas ?? {};

  document.components ??= {};
  document.components.schemas ??= {};
  for (const [name, schema] of Object.entries(schemas)) {
    // O alvo openapi-3.0 do zod produz exatamente o dialeto que o @nestjs/swagger emite;
    // o cast existe só porque os dois pacotes declaram o mesmo formato com tipos diferentes.
    document.components.schemas[name] = z.toJSONSchema(schema, {
      target: 'openapi-3.0',
      io: 'input',
    }) as SchemaObject;
  }

  SwaggerModule.setup(OPENAPI_PATH, app, document);
}
