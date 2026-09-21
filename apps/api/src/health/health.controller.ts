import { Public } from '@erp/platform-http';
import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Pool } from 'pg';
import { DB_POOL } from '../tokens';

export interface LivenessStatus {
  readonly status: 'ok';
}

export interface ReadinessStatus {
  readonly status: 'ready';
  readonly checks: { readonly database: 'ok' };
}

/**
 * Endpoints públicos de sondagem (CLAUDE.md §4.5: só health e webhook do Clerk
 * dispensam autenticação).
 *
 * `/health` é liveness: responde enquanto o processo estiver de pé, sem tocar em
 * dependência nenhuma. `/ready` é readiness: só responde quando o banco responde,
 * que é o que o orquestrador precisa saber antes de mandar tráfego.
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Liveness: o processo está de pé' })
  check(): LivenessStatus {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness: as dependências respondem' })
  async ready(): Promise<ReadinessStatus> {
    try {
      await this.pool.query('select 1');
    } catch {
      throw new ServiceUnavailableException('O banco de dados não respondeu.');
    }
    return { status: 'ready', checks: { database: 'ok' } };
  }
}
