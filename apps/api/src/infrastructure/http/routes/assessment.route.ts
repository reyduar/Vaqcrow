import { parseAssessmentEvidenceBundle, runAssessment } from "@vaqcrow/ai";
import type { AssessmentProviderPort } from "@vaqcrow/ai";
import type { FastifyInstance } from "fastify";

/**
 * The HTTP surface of a real assessment.
 *
 * The route owns three things the use case deliberately does not: the exact body
 * key set (a body that drifted from the contract is refused before any parsing
 * work), the status-code mapping, and nothing else. The orchestration — call,
 * validate against the contract, validate the citations against the supplied
 * evidence — lives in `@vaqcrow/ai`, provider-independent, so it is shared with
 * the bake-off and cannot drift from what the application does.
 *
 * Failure statuses are chosen so a caller can act on them:
 *
 * - `504` the provider did not answer in time;
 * - `503` the provider is unavailable;
 * - `502` the provider answered, and the answer was not admissible — either it
 *   did not satisfy the contract or it cited evidence the model was never given.
 *   The request was fine in both, which is what separates them from a `400`.
 *
 * None of them returns an assessment, and none of them approves anything.
 * Routing a failure to manual review is the caller's decision and belongs to
 * Feature #22, not here: this route reports the failure truthfully and stops.
 */

const BODY_KEYS = new Set(["evidence"]);

export interface AssessmentRouteDependencies {
  readonly provider: AssessmentProviderPort;
  /**
   * The bound for this call, from the validated configuration. Passed rather
   * than defaulted here, so the value an operator set is the value that applies.
   */
  readonly timeoutMs: number;
}

function hasExactBodyKeys(input: unknown): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  const keys = Object.keys(input);
  return keys.length === BODY_KEYS.size && keys.every((key) => BODY_KEYS.has(key));
}

export function registerAssessmentRoute(
  app: FastifyInstance,
  dependencies: AssessmentRouteDependencies
): void {
  app.post<{ Body: unknown }>("/assessments", async (request, reply) => {
    if (!hasExactBodyKeys(request.body)) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    let evidence;
    try {
      evidence = parseAssessmentEvidenceBundle(request.body["evidence"]);
    } catch {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const result = await runAssessment(dependencies.provider, {
      evidence,
      timeoutMs: dependencies.timeoutMs
    });

    if (result.ok) {
      // The metadata travels with the assessment because `DEMO.md` §5 requires a
      // recommendation to show which model and which prompt produced it.
      return reply.code(200).send({
        assessment: result.value.assessment,
        metadata: result.value.metadata
      });
    }

    switch (result.error.code) {
      case "timeout":
        return reply.code(504).send({ code: "timeout" });
      case "provider_unavailable":
        return reply.code(503).send({ code: "provider_unavailable" });
      case "invalid_output":
        return reply.code(502).send({ code: "invalid_output" });
      case "unknown_evidence_reference":
        // The offending references are the model's own output, not a secret, and
        // a caller needs them to explain why a case went to a person.
        return reply.code(502).send({
          code: "unknown_evidence_reference",
          violations: result.error.violations
        });
    }
  });
}
