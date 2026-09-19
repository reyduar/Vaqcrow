import { parseHumanDecisionCommand, type HumanDecisionId } from "@vaqcrow/contracts";
import type { HumanDecisionGateway, RecordedHumanDecision } from "@/application/ports/human-decision-gateway";
import type { DecisionInput } from "./decision-form";
import { decisionErrorOfKind, toDecisionSubmitError, type DecisionSubmitError } from "./human-decision-errors";

export interface RecordHumanDecisionRequest {
  readonly applicationId: string;
  readonly decisionId: HumanDecisionId;
  readonly input: DecisionInput;
}

export type RecordHumanDecisionResult =
  | { readonly ok: true; readonly value: RecordedHumanDecision }
  | { readonly ok: false; readonly error: DecisionSubmitError };

/**
 * Builds the contract command, refuses to send anything that breaks it, and
 * records the decision through the gateway. Never throws: every failure is a
 * sanitized `error` result so callers cannot mistake it for a recorded decision.
 */
export async function recordHumanDecision(
  gateway: HumanDecisionGateway,
  request: RecordHumanDecisionRequest
): Promise<RecordHumanDecisionResult> {
  let command;
  try {
    command = parseHumanDecisionCommand({
      applicationId: request.applicationId,
      decisionId: request.decisionId,
      ...request.input
    });
  } catch {
    return { ok: false, error: decisionErrorOfKind("validation") };
  }

  try {
    return { ok: true, value: await gateway.record(command) };
  } catch (error) {
    return { ok: false, error: toDecisionSubmitError(error) };
  }
}
