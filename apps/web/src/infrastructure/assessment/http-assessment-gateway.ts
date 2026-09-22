import { parseAssessmentView } from "@/application/assessment/assessment-view";
import type { AssessmentEvidence, AssessmentGateway } from "@/application/ports/assessment-gateway";
import type { AssessmentView } from "@/application/assessment/assessment-view";
import type { HttpClientPort } from "@/application/ports/http-client-port";

/**
 * `POST /assessments`.
 *
 * The body carries exactly `evidence`, because the API refuses any other key
 * set before it does any parsing work. The response is validated here rather
 * than trusted: the backend validated the *model's* answer, and this validates
 * that what reached the browser is the shape the screen reads.
 */
export class HttpAssessmentGateway implements AssessmentGateway {
  constructor(private readonly http: HttpClientPort) {}

  async assess(evidence: AssessmentEvidence): Promise<AssessmentView> {
    const response = await this.http.send<unknown>({
      method: "POST",
      path: "/assessments",
      body: {
        evidence: {
          periods: evidence.periods,
          findings: evidence.findings
        }
      }
    });

    return parseAssessmentView(response.body);
  }
}
