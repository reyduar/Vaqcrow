import { assessmentFailureCodeSchema } from "@vaqcrow/contracts";
import { parseAssessmentView } from "@/application/assessment/assessment-view";
import type { AssessmentView } from "@/application/assessment/assessment-view";
import type { AssessmentGateway, AssessmentOutcome } from "@/application/ports/assessment-gateway";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HttpClientPort } from "@/application/ports/http-client-port";

const RECORDED_KEYS = new Set([
  "outcome",
  "applicationState",
  "applied",
  "correlationId",
  "assessment",
  "metadata",
  "recordedAt"
]);
const READ_KEYS = new Set(["assessment", "metadata", "recordedAt"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Admits a persisted-assessment envelope: only the declared keys, a recording
 * time, and an assessment/metadata pair the screen can read. A drifted response
 * is an error, never a half-rendered panel.
 */
function toView(body: Record<string, unknown>, allowed: ReadonlySet<string>): AssessmentView {
  if (Object.keys(body).some((key) => !allowed.has(key)) || typeof body["recordedAt"] !== "string") {
    throw new TypeError("Invalid assessment envelope");
  }

  return parseAssessmentView({ assessment: body["assessment"], metadata: body["metadata"] });
}

/**
 * `POST /application-reviews/:applicationId/assessments` and
 * `GET /application-reviews/:applicationId/assessment`.
 *
 * The POST body is exactly `{ handoffId }`: the server derives the evidence, so
 * the browser can no longer supply any. The three declared results are told
 * apart here — a recorded assessment, the manual-review routing (no assessment)
 * and `409 sales_evidence_missing` (nothing evaluated) — and every other failure
 * is rethrown untouched so a broken backend is never dressed as one of them.
 */
export class HttpAssessmentGateway implements AssessmentGateway {
  constructor(private readonly http: HttpClientPort) {}

  async assess(applicationId: string, handoffId: string): Promise<AssessmentOutcome> {
    let body: unknown;
    try {
      const response = await this.http.send<unknown>({
        method: "POST",
        path: `/application-reviews/${encodeURIComponent(applicationId)}/assessments`,
        body: { handoffId }
      });
      body = response.body;
    } catch (error) {
      if (error instanceof HttpClientError && error.status === 409 && error.errorCode === "sales_evidence_missing") {
        return { kind: "sales_evidence_missing" };
      }
      throw error;
    }

    if (!isRecord(body) || body["applicationState"] !== "human_review") {
      throw new TypeError("Invalid assessment envelope");
    }

    if (body["outcome"] === "assessment_recorded") {
      return { kind: "recorded", view: toView(body, RECORDED_KEYS) };
    }

    if (body["outcome"] === "manual_review") {
      const failureCode = assessmentFailureCodeSchema.safeParse(body["failureCode"]);

      if (!failureCode.success) {
        throw new TypeError("Invalid assessment response: failureCode");
      }

      return { kind: "manual_review", failureCode: failureCode.data };
    }

    throw new TypeError("Invalid assessment envelope");
  }

  async load(applicationId: string): Promise<AssessmentView | null> {
    let body: unknown;
    try {
      const response = await this.http.send<unknown>({
        method: "GET",
        path: `/application-reviews/${encodeURIComponent(applicationId)}/assessment`
      });
      body = response.body;
    } catch (error) {
      if (error instanceof HttpClientError && error.kind === "http" && error.status === 404) {
        return null;
      }
      throw error;
    }

    if (!isRecord(body)) {
      throw new TypeError("Invalid assessment envelope");
    }

    return toView(body, READ_KEYS);
  }
}
