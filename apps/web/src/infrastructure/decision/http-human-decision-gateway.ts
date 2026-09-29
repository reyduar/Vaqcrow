import { humanDecisionRecordSchema, type HumanDecisionCommand, type HumanDecisionRecord } from "@vaqcrow/contracts";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import type { HumanDecisionGateway, RecordedHumanDecision } from "@/application/ports/human-decision-gateway";

function parseResponse(body: unknown): RecordedHumanDecision {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new TypeError("Invalid human decision envelope");
  }
  const { applied, decision, ...extra } = body as Record<string, unknown>;
  if (Object.keys(extra).length > 0 || typeof applied !== "boolean") {
    throw new TypeError("Invalid human decision envelope");
  }
  return { applied, decision: humanDecisionRecordSchema.parse(decision) };
}

/**
 * The `{ decision }` envelope the latest-decision read answers with. Extra keys
 * are rejected the same way `parseResponse` rejects them, so a widened envelope
 * is a thrown `TypeError` rather than a half-trusted record.
 */
function parseLatestResponse(body: unknown): HumanDecisionRecord {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new TypeError("Invalid human decision envelope");
  }
  const { decision, ...extra } = body as Record<string, unknown>;
  if (Object.keys(extra).length > 0) {
    throw new TypeError("Invalid human decision envelope");
  }
  return humanDecisionRecordSchema.parse(decision);
}

/**
 * `POST /application-reviews/:applicationId/decisions` (201 applied, 200 replay).
 * The body carries exactly `decisionId, outcome, actor, reason, approvedLimitArs`;
 * the API rejects any other key, so `applicationId` travels only in the path.
 * `GET` on the same path reads the latest decision back, `404` when none exists.
 */
export class HttpHumanDecisionGateway implements HumanDecisionGateway {
  constructor(private readonly http: HttpClientPort) {}

  async record(command: HumanDecisionCommand): Promise<RecordedHumanDecision> {
    const { applicationId, decisionId, outcome, actor, reason, approvedLimitArs } = command;
    const response = await this.http.send<unknown>({
      method: "POST",
      path: `/application-reviews/${encodeURIComponent(applicationId)}/decisions`,
      body: { decisionId, outcome, actor, reason, approvedLimitArs }
    });
    return parseResponse(response.body);
  }

  async readLatest(applicationId: string): Promise<HumanDecisionRecord | null> {
    let body: unknown;
    try {
      const response = await this.http.send<unknown>({
        method: "GET",
        path: `/application-reviews/${encodeURIComponent(applicationId)}/decisions`
      });
      body = response.body;
    } catch (error) {
      // Only the API's own `not_found` answer is a truthful "no decision recorded
      // yet", and it resolves to `null`. A 404 that is not that answer — a
      // misrouted or misconfigured base URL, a different service — is a failure to
      // read, not proof that no decision exists, and is rethrown as such
      // (R3-latest-decision-absence-classification). So is a malformed body.
      if (
        error instanceof HttpClientError &&
        error.kind === "http" &&
        error.status === 404 &&
        error.errorCode === "not_found"
      ) {
        return null;
      }
      throw error;
    }

    return parseLatestResponse(body);
  }
}
