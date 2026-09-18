import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import {
  HttpClientError,
  type HttpClientPort,
  type HttpFieldErrors,
  type HttpRequest,
  type HttpResponse
} from "@/application/ports/http-client-port";

export { HttpClientError };

const DEFAULT_TIMEOUT_MS = 10_000;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
const CODE_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

/**
 * Extracts `field -> code` tokens from the documented backend validation
 * envelope `{ errors: [{ field, code }] }`. Anything else in the body
 * (messages, stacks, unknown shapes) is discarded; tokens must look like
 * identifiers so free text can never travel through this channel. Which
 * fields/codes are meaningful is decided by `application/`, not here.
 */
function extractFieldErrors(data: unknown): HttpFieldErrors | undefined {
  if (typeof data !== "object" || data === null || !("errors" in data)) return undefined;
  const entries = (data as { errors: unknown }).errors;
  if (!Array.isArray(entries)) return undefined;

  const result = new Map<string, string>();
  for (const entry of entries as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const { field, code } = entry as { field?: unknown; code?: unknown };
    if (
      typeof field === "string" &&
      typeof code === "string" &&
      field !== "__proto__" &&
      FIELD_PATTERN.test(field) &&
      CODE_PATTERN.test(code)
    ) {
      result.set(field, code);
    }
  }
  return result.size > 0 ? Object.fromEntries(result) : undefined;
}

export interface AxiosHttpClientOptions {
  readonly baseUrl: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** Request timeout in milliseconds; defaults to 10s. */
  readonly timeoutMs?: number;
}

/** Axios-backed implementation of `HttpClientPort`. Axios must not leak outside this file. */
export class AxiosHttpClient implements HttpClientPort {
  constructor(private readonly instance: AxiosInstance) {}

  static create(
    options: AxiosHttpClientOptions,
    createInstance: (config: AxiosRequestConfig) => AxiosInstance = (config) => axios.create(config)
  ): AxiosHttpClient {
    return new AxiosHttpClient(
      createInstance({
        baseURL: options.baseUrl,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        ...(options.headers ? { headers: { ...options.headers } } : {})
      })
    );
  }

  async send<T>(request: HttpRequest): Promise<HttpResponse<T>> {
    let response: { status: number; data: unknown };
    try {
      response = await this.instance.request({
        method: request.method,
        url: request.path,
        ...(request.body !== undefined ? { data: request.body } : {}),
        // Non-2xx statuses are mapped by this adapter, not by axios.
        validateStatus: () => true
      });
    } catch {
      // Deliberately drop the original error: it may embed URLs, headers or tokens.
      throw new HttpClientError("network");
    }

    if (response.status < 200 || response.status >= 300) {
      throw new HttpClientError("http", response.status, extractFieldErrors(response.data));
    }
    return { status: response.status, body: response.data as T };
  }
}
