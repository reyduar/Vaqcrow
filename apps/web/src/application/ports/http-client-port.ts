export interface HttpRequest {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly path: string;
  readonly body?: unknown;
}

export interface HttpResponse<T> {
  readonly status: number;
  readonly body: T;
}

export interface HttpClientPort {
  send<T>(request: HttpRequest): Promise<HttpResponse<T>>;
}

/** Sanitized `field -> code` map extracted from a backend validation envelope. */
export type HttpFieldErrors = Readonly<Record<string, string>>;

/**
 * Sanitized failure of an `HttpClientPort` call. It carries only a coarse kind,
 * the status code and, for HTTP failures, whitelisted `field -> code` tokens.
 * Raw messages, headers, request config and response bodies are never exposed.
 * Lives with the port so `application/` can catch it without importing infrastructure.
 */
export class HttpClientError extends Error {
  readonly kind: "http" | "network";
  readonly status: number | undefined;
  readonly fieldErrors: HttpFieldErrors | undefined;
  /** Sanitized machine code from a `{ code }` error envelope (e.g. `state_conflict`); never free text. */
  readonly errorCode: string | undefined;

  constructor(
    kind: "http" | "network",
    status?: number,
    fieldErrors?: HttpFieldErrors,
    errorCode?: string
  ) {
    super(kind === "http" ? `HTTP request failed with status ${status}` : "Network request failed");
    this.name = "HttpClientError";
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.errorCode = errorCode;
  }

  toJSON(): {
    name: string;
    kind: "http" | "network";
    status: number | undefined;
    fieldErrors: HttpFieldErrors | undefined;
    errorCode?: string;
  } {
    return {
      name: this.name,
      kind: this.kind,
      status: this.status,
      fieldErrors: this.fieldErrors,
      ...(this.errorCode !== undefined ? { errorCode: this.errorCode } : {})
    };
  }
}
