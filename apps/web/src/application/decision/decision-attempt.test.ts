import { describe, expect, it, vi } from "vitest";
import { resolveDecisionAttempt } from "./decision-attempt";

const input = { outcome: "rejected", actor: "op", reason: "no", approvedLimitArs: null } as const;

describe("resolveDecisionAttempt", () => {
  it("generates a fresh decision id when there is no previous attempt", () => {
    const generate = vi.fn().mockReturnValue("11111111-1111-4111-8111-111111111111");
    const attempt = resolveDecisionAttempt(undefined, input, generate);
    expect(attempt.decisionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("reuses the same decision id when retrying the identical payload", () => {
    const generate = vi.fn().mockReturnValueOnce("11111111-1111-4111-8111-111111111111");
    const first = resolveDecisionAttempt(undefined, input, generate);
    const retry = resolveDecisionAttempt(first, { ...input }, generate);
    expect(retry.decisionId).toBe(first.decisionId);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("generates a new decision id when the payload changed", () => {
    const generate = vi
      .fn()
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    const first = resolveDecisionAttempt(undefined, input, generate);
    const changed = resolveDecisionAttempt(first, { ...input, reason: "different" }, generate);
    expect(changed.decisionId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("rejects a generator that does not produce a UUIDv4", () => {
    expect(() => resolveDecisionAttempt(undefined, input, () => "not-a-uuid")).toThrow();
  });
});
