import type { HttpClientPort, HttpRequest, HttpResponse } from "@/application/ports/http-client-port";

/**
 * Stub adapter for the platform `fetch` HTTP client.
 * Every method throws until backend HTTP integration is implemented.
 */
export class FetchHttpClient implements HttpClientPort {
  async send<T>(_request: HttpRequest): Promise<HttpResponse<T>> {
    throw new Error("not implemented");
  }
}
