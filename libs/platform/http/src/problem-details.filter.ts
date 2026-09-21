import { getCorrelationId, type Logger } from '@erp/platform-observability';
import {
  CONCURRENCY_CONFLICT,
  DomainError,
  ENTITY_NOT_FOUND,
  FORBIDDEN,
  UNAUTHENTICATED,
  VALIDATION_ERROR,
  ValidationError,
} from '@erp/shared-kernel';
import { PROBLEM_CONTENT_TYPE, type ProblemDetails } from '@erp/shared-contracts';
import { type ArgumentsHost, type ExceptionFilter, Catch, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';

const INTERNAL_ERROR = 'INTERNAL_ERROR';

/**
 * Status HTTP de cada `DomainError.code` conhecido da plataforma.
 * Regra de negócio violada que não esteja aqui vira 422: o pedido foi entendido,
 * mas o domínio recusou.
 */
const STATUS_BY_CODE: Readonly<Record<string, number>> = {
  [VALIDATION_ERROR]: 400,
  [UNAUTHENTICATED]: 401,
  [FORBIDDEN]: 403,
  [ENTITY_NOT_FOUND]: 404,
  [CONCURRENCY_CONFLICT]: 409,
};

const DOMAIN_ERROR_DEFAULT_STATUS = 422;

/**
 * Único lugar que transforma exceção em resposta (CLAUDE.md §5): todo erro sai em
 * `application/problem+json` (RFC 9457) com um `code` estável em inglês.
 *
 * O que o cliente recebe nunca inclui stack nem mensagem de erro inesperado — isso vai
 * para o log, junto do `correlationId` que o cliente também recebeu.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const problem = this.toProblem(exception, request);

    if (problem.status >= 500) {
      this.logger.error(
        { err: exception, path: request.originalUrl ?? request.url },
        'erro não tratado na requisição',
      );
    } else {
      this.logger.warn(
        { code: problem.code, status: problem.status, path: request.originalUrl ?? request.url },
        'requisição recusada',
      );
    }

    response.status(problem.status).type(PROBLEM_CONTENT_TYPE).send(problem);
  }

  private toProblem(exception: unknown, request: Request): ProblemDetails {
    const correlationId = getCorrelationId();
    const base = {
      instance: request.originalUrl ?? request.url,
      ...(correlationId === undefined ? {} : { correlationId }),
    };

    if (exception instanceof ValidationError) {
      return {
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 400,
        detail: exception.message,
        code: exception.code,
        errors: [...exception.issues],
        ...base,
      };
    }

    if (exception instanceof DomainError) {
      const status = STATUS_BY_CODE[exception.code] ?? DOMAIN_ERROR_DEFAULT_STATUS;
      return {
        type: 'about:blank',
        title: titleFor(status),
        status,
        detail: exception.message,
        code: exception.code,
        ...base,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        type: 'about:blank',
        title: titleFor(status),
        status,
        detail: exception.message,
        code: codeForHttpStatus(status),
        ...base,
      };
    }

    return {
      type: 'about:blank',
      title: 'Erro interno',
      status: 500,
      detail: 'Erro inesperado. Cite o correlationId ao relatar o problema.',
      code: INTERNAL_ERROR,
      ...base,
    };
  }
}

function titleFor(status: number): string {
  const titles: Readonly<Record<number, string>> = {
    400: 'Dados inválidos',
    401: 'Autenticação necessária',
    403: 'Acesso negado',
    404: 'Não encontrado',
    409: 'Conflito de versão',
    422: 'Regra de negócio violada',
    500: 'Erro interno',
  };
  return titles[status] ?? 'Erro';
}

function codeForHttpStatus(status: number): string {
  const codes: Readonly<Record<number, string>> = {
    400: VALIDATION_ERROR,
    401: UNAUTHENTICATED,
    403: FORBIDDEN,
    404: 'ROUTE_NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: CONCURRENCY_CONFLICT,
    413: 'PAYLOAD_TOO_LARGE',
    415: 'UNSUPPORTED_MEDIA_TYPE',
    429: 'TOO_MANY_REQUESTS',
  };
  return codes[status] ?? (status >= 500 ? INTERNAL_ERROR : 'REQUEST_REJECTED');
}
