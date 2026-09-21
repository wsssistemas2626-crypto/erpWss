import { Public } from '@erp/platform-http';
import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { DB_POOL_FOR_WEBHOOKS } from './tokens';
import { IDENTITY_PROVIDER, type IdentityProvider } from '../identity-provider';
import { IdentitySyncService } from './identity-sync-service';
import { SVIX_ID_HEADER, SVIX_SIGNATURE_HEADER, SVIX_TIMESTAMP_HEADER } from './webhook-event';
import { WebhookSignatureInvalidError } from './webhook-errors';

export interface WebhookAck {
  readonly received: true;
  readonly outcome: 'applied' | 'ignored' | 'duplicated';
}

/**
 * Recebe os webhooks do provedor de identidade (ADR-004).
 *
 * Pública por necessidade: quem chama é o provedor, não um usuário. A autenticação é a
 * assinatura sobre o **corpo bruto** — por isso o corpo é lido de `request.rawBody`, e não
 * do JSON já parseado: reserializar mudaria os bytes e a assinatura deixaria de bater.
 *
 * Idempotente pelo `svix-id`: reentrega responde 200 sem aplicar nada de novo, que é o que
 * faz o provedor parar de reentregar.
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class ClerkWebhookController {
  constructor(
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    private readonly sync: IdentitySyncService,
    @Inject(DB_POOL_FOR_WEBHOOKS) private readonly pool: Pool,
  ) {}

  @Post('clerk')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook do Clerk (usuários, organizações e vínculos)' })
  async receive(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers() headers: Record<string, string>,
  ): Promise<WebhookAck> {
    const payload = rawBodyOf(request);

    const event = await this.identity.verifyWebhook({
      payload,
      headers: {
        [SVIX_ID_HEADER]: headers[SVIX_ID_HEADER] ?? '',
        [SVIX_TIMESTAMP_HEADER]: headers[SVIX_TIMESTAMP_HEADER] ?? '',
        [SVIX_SIGNATURE_HEADER]: headers[SVIX_SIGNATURE_HEADER] ?? '',
      },
    });

    const svixId = headers[SVIX_ID_HEADER] ?? '';
    const claimed = await this.pool.query(
      `insert into platform.processed_webhooks (svix_id, event_type)
       values ($1, $2)
       on conflict (svix_id) do nothing`,
      [svixId, event.type],
    );

    if (claimed.rowCount === 0) {
      return { received: true, outcome: 'duplicated' };
    }

    const outcome = await this.sync.apply(event);
    return { received: true, outcome };
  }
}

function rawBodyOf(request: Request & { rawBody?: Buffer }): string {
  if (request.rawBody !== undefined) {
    return request.rawBody.toString('utf8');
  }
  throw new WebhookSignatureInvalidError('corpo bruto do webhook não foi preservado');
}
