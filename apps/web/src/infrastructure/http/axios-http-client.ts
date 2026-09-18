import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import type { HttpClientPort, HttpRequest, HttpResponse } from "@/application/ports/http-client-port";

/**
 * Sanitized failure raised by the HTTP adapter. It carries only a coarse kind
 * and, for HTTP failures, the status code. Raw axios messages, headers, request
 * config and response bodies are never exposed to callers.
 */
export class HttpClientError extends Error {
  readonly kind: "http" | "network";
  readonly status: number | undefined;

  constructor(kind: "http" | "network", status?: number) {
    super(kind === "http" ? `HTTP request failed with status ${status}` : "Network request failed");
    this.name = "HttpClientError";
    this.kind = kind;
    this.status = status;
  }

  toJSON(): { name: string; kind: "http" | "network"; status: number | undefined } {
    return { name: this.name, kind: this.kind, status: this.status };
  }
}

export interface AxiosHttpClientOptions {
  readonly baseUrl: string;
  readonly headers?: Readonly<Record<string, string>>;
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
      throw new HttpClientError("http", response.status);
    }
    return { status: response.status, body: response.data as T };
  }
}
