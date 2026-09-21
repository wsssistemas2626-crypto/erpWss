import { newId } from '@erp/shared-kernel';
import { runWithLogContext } from '@erp/platform-observability';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Correlação ponta a ponta (RNF033): aceita o `X-Correlation-Id` que o cliente mandar
 * e, na falta, gera um. Devolve no header da resposta para que o cliente consiga citar
 * a requisição ao abrir um chamado, e deixa no contexto para todo log da requisição.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const received = request.header(CORRELATION_ID_HEADER);
    const correlationId =
      received !== undefined && received.trim().length > 0
        ? received.trim().slice(0, 128)
        : newId();

    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    runWithLogContext({ correlationId }, () => {
      next();
    });
  }
}
