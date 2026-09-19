import { describe, expect, it, vi } from "vitest";
import { parseHumanDecisionId } from "@vaqcrow/contracts";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HumanDecisionGateway } from "@/application/ports/human-decision-gateway";
import { recordHumanDecision } from "./record-human-decision";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DECISION_ID = parseHumanDecisionId("11111111-1111-4111-8111-111111111111");
const RECORD = {
  decisionId: DECISION_ID,
  applicationId: APPLICATION_ID,
  outcome: "rejected",
  actor: "op",
  reason: "no",
  approvedLimitArs: null,
  decidedAt: "2026-09-19T12:00:00.000Z",
  correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
} as const;

const request = {
  applicationId: APPLICATION_ID,
  decisionId: DECISION_ID,
  input: { outcome: "rejected", actor: "op", reason: "no", approvedLimitArs: null }
} as const;

describe("recordHumanDecision", () => {
  it("sends the full contract command and returns the recorded decision", async () => {
    const record = vi.fn().mockResolvedValue({ applied: true, decision: RECORD });
    const gateway: HumanDecisionGateway = { record };

    const result = await recordHumanDecision(gateway, request);

    expect(record).toHaveBeenCalledWith({ ...request.input, applicationId: APPLICATION_ID, decisionId: DECISION_ID });
    expect(result).toEqual({ ok: true, value: { applied: true, decision: RECORD } });
  });

  it("refuses to call the backend when the command breaks the contract invariant", async () => {
    const record = vi.fn();
    const result = await recordHumanDecision(
      { record },
      { ...request, input: { outcome: "approved", actor: "op", reason: "ok", approvedLimitArs: null } }
    );

    expect(record).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: { kind: "validation" } });
  });

  it("maps a gateway failure to a sanitized error result", async () => {
    const record = vi.fn().mockRejectedValue(new HttpClientError("http", 409, undefined, "state_conflict"));
    const result = await recordHumanDecision({ record }, request);
    expect(result).toMatchObject({ ok: false, error: { kind: "state_conflict" } });
  });
});
