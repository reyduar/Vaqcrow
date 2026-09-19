import { humanDecisionRecordSchema, type HumanDecisionCommand } from "@vaqcrow/contracts";
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
 * `POST /application-reviews/:applicationId/decisions` (201 applied, 200 replay).
 * The body carries exactly `decisionId, outcome, actor, reason, approvedLimitArs`;
 * the API rejects any other key, so `applicationId` travels only in the path.
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
}
