import {
  PROBLEM_CONTENT_TYPE,
  problemDetailsSchema,
  type ProblemDetails,
} from '@erp/shared-contracts';
import type { ZodType } from 'zod';

/**
 * Cliente HTTP tipado pelos schemas zod de `@erp/shared-contracts` (CLAUDE.md §5).
 * O mesmo schema que valida a entrada no servidor tipa e valida a resposta no front.
 *
 * O token do Clerk é buscado a cada chamada via `getToken()` (ADR-004): o SDK cuida
 * da renovação, então guardar o token em memória arriscaria enviar um token vencido.
 */

export type TokenGetter = () => Promise<string | null>;

export type QueryParams = Record<string, string | number | boolean | undefined>;

/** Erro de API já no formato RFC 9457; `problem.code` é a chave estável para a mensagem pt-BR. */
export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }

  get status(): number {
    return this.problem.status;
  }

  get code(): string {
    return this.problem.code;
  }
}

function problem(status: number, code: string, title: string): ProblemDetails {
  return { type: 'about:blank', title, status, code };
}

export interface ApiClientOptions {
  /** Base da API, ex.: `/api/v1`. */
  baseUrl: string;
  getToken: TokenGetter;
  /** Injetável nos testes; por padrão o `fetch` global. */
  fetchImpl?: typeof fetch;
}

export interface RequestConfig<TOut> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  /** Schema da resposta. Ausente para respostas sem corpo (204). */
  schema?: ZodType<TOut>;
  body?: unknown;
  query?: QueryParams;
  signal?: AbortSignal;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getToken: TokenGetter;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getToken = options.getToken;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async request<TOut = void>(config: RequestConfig<TOut>): Promise<TOut> {
    const token = await this.getToken();
    if (token === null) {
      throw new ApiError(problem(401, 'session_expired', 'Sessão expirada'));
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (config.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await this.fetchImpl(this.buildUrl(config.path, config.query), {
      method: config.method,
      headers,
      body: config.body === undefined ? undefined : JSON.stringify(config.body),
      signal: config.signal,
    });

    if (!response.ok) {
      throw new ApiError(await this.readProblem(response));
    }

    if (config.schema === undefined || response.status === 204) {
      return undefined as TOut;
    }

    const parsed = config.schema.safeParse(await response.json());
    if (!parsed.success) {
      throw new ApiError(
        problem(response.status, 'invalid_response', 'Resposta inesperada do servidor'),
      );
    }
    return parsed.data;
  }

  get<TOut>(path: string, schema: ZodType<TOut>, query?: QueryParams): Promise<TOut> {
    return this.request({ method: 'GET', path, schema, query });
  }

  post<TOut>(path: string, body: unknown, schema?: ZodType<TOut>): Promise<TOut> {
    return this.request({ method: 'POST', path, body, schema });
  }

  put<TOut>(path: string, body: unknown, schema?: ZodType<TOut>): Promise<TOut> {
    return this.request({ method: 'PUT', path, body, schema });
  }

  patch<TOut>(path: string, body: unknown, schema?: ZodType<TOut>): Promise<TOut> {
    return this.request({ method: 'PATCH', path, body, schema });
  }

  delete(path: string): Promise<void> {
    return this.request({ method: 'DELETE', path });
  }

  private buildUrl(path: string, query?: QueryParams): string {
    const url = `${this.baseUrl}/${path.replace(/^\//, '')}`;
    if (query === undefined) {
      return url;
    }
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        search.append(key, String(value));
      }
    }
    const rendered = search.toString();
    return rendered === '' ? url : `${url}?${rendered}`;
  }

  /** Converte a resposta de erro em `ProblemDetails`, mesmo quando o corpo não é problem+json. */
  private async readProblem(response: Response): Promise<ProblemDetails> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes(PROBLEM_CONTENT_TYPE)) {
      const parsed = problemDetailsSchema.safeParse(await response.json().catch(() => null));
      if (parsed.success) {
        return parsed.data;
      }
    }
    return problem(response.status, 'unexpected_error', response.statusText || 'Erro inesperado');
  }
}
