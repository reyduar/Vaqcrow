import { parseApplicationManualReviewContext } from "@vaqcrow/contracts";
import type { ApplicationManualReviewContext } from "@vaqcrow/contracts";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import type { ManualReviewGateway } from "@/application/ports/manual-review-gateway";

/**
 * `GET /application-reviews/:applicationId/manual-review`.
 *
 * A `404 not_found` is the backend's truthful "no handoff exists for this
 * application": it resolves to `null` so the screen can fall back to its
 * unrelated-flow copy. Every other failure — including a malformed body — is
 * rethrown so a broken backend is never mistaken for "no context".
 */
export class HttpManualReviewGateway implements ManualReviewGateway {
  constructor(private readonly http: HttpClientPort) {}

  async load(applicationId: string): Promise<ApplicationManualReviewContext | null> {
    let body: unknown;
    try {
      const response = await this.http.send<unknown>({
        method: "GET",
        path: `/application-reviews/${encodeURIComponent(applicationId)}/manual-review`
      });
      body = response.body;
    } catch (error) {
      if (error instanceof HttpClientError && error.kind === "http" && error.status === 404) {
        return null;
      }
      throw error;
    }

    // The contract parser is strict at every level: a drifted response throws
    // rather than rendering a record that silently widened.
    return parseApplicationManualReviewContext(body);
  }
}
