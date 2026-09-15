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
