import { describe, expect, it } from 'vitest';
import { findUnprotectedWriteRoutes, scanControllerSource } from './controller-permissions';
import { join } from 'node:path';

const WORKSPACE_ROOT = join(__dirname, '..', '..', '..');

describe('F0-08 toda rota de escrita declara permissão', () => {
  it('não há rota de escrita sem @RequirePermission nem @Public no repositório', () => {
    const unprotected = findUnprotectedWriteRoutes(WORKSPACE_ROOT);

    const descricao = unprotected.map(
      (route) =>
        `${route.file}:${String(route.line)} ${route.className}.${route.methodName}() ` +
        `responde @${route.httpMethod} sem @RequirePermission nem @Public`,
    );

    expect(descricao).toEqual([]);
  });

  it('aponta o método quando o decorator é esquecido', () => {
    const encontrado = scanControllerSource(
      'exemplo.controller.ts',
      `
      import { Controller, Post } from '@nestjs/common';

      @Controller('projects')
      export class ProjectsController {
        @Post()
        create() {
          return { ok: true };
        }
      }
      `,
    );

    expect(encontrado).toHaveLength(1);
    expect(encontrado[0]).toMatchObject({
      className: 'ProjectsController',
      methodName: 'create',
      httpMethod: 'Post',
    });
  });

  it('aceita a rota que declara a permissão', () => {
    const encontrado = scanControllerSource(
      'exemplo.controller.ts',
      `
      @Controller('projects')
      export class ProjectsController {
        @Post()
        @RequirePermission('projects.project.create')
        create() {
          return { ok: true };
        }
      }
      `,
    );

    expect(encontrado).toEqual([]);
  });

  it('aceita a rota explicitamente pública', () => {
    const encontrado = scanControllerSource(
      'webhooks.controller.ts',
      `
      @Controller('webhooks')
      export class WebhooksController {
        @Post('clerk')
        @Public()
        receive() {
          return { ok: true };
        }
      }
      `,
    );

    expect(encontrado).toEqual([]);
  });

  it('não reclama de leitura: GET sem permissão continua valendo', () => {
    const encontrado = scanControllerSource(
      'exemplo.controller.ts',
      `
      @Controller('projects')
      export class ProjectsController {
        @Get()
        list() {
          return [];
        }
      }
      `,
    );

    expect(encontrado).toEqual([]);
  });
});
