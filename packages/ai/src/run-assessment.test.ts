import { describe, expect, it } from "vitest";
import {
  citableReferences,
  createSimulatedAssessmentProvider,
  runAssessment
} from "./index.js";
import type {
  AssessmentEvidenceBundle,
  AssessmentProviderOutcome,
  AssessmentProviderPort,
  AssessmentRetryPolicy
} from "./index.js";

/**
 * Focused behaviour for the replaceable provider boundary (Feature #21, Task #68).
 *
 * The full matrix belongs to Task #69; this is the smallest set that establishes
 * the four things the boundary must do: call a replaceable provider, keep the
 * model/prompt metadata, validate the output against the assessment contract,
 * and turn every failure into a typed error instead of a success.
 */

const JANUARY = {
  period: "2026-01",
  amountArs: 1_200_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
} as const;

const JUNE = {
  period: "2026-06",
  amountArs: 3_400_000,
  status: "anomalous",
  evidenceRef: "sales:2026-06",
  simuladoLabel: "SIMULADO"
} as const;

const APRIL = {
  period: "2026-04",
  amountArs: null,
  status: "missing",
  evidenceRef: "missing:2026-04",
  simuladoLabel: "SIMULADO"
} as const;

const FINDING_APRIL = {
  kind: "missing",
  period: "2026-04",
  evidenceRef: "missing:2026-04",
  messageKey: "sales.period.missing"
} as const;

const EVIDENCE: AssessmentEvidenceBundle = {
  periods: [JANUARY, JUNE, APRIL],
  findings: [FINDING_APRIL]
};

const VALID_OUTPUT = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [{ type: "outlier", evidenceRef: "sales:2026-06", severity: "review" }],
  missingData: ["Declaración del período 2026-04"],
  recommendedAction: "human_review",
  questions: ["¿Qué explica el incremento de junio?"]
} as const;

const FIXED_NOW = "2026-09-22T12:00:00.000Z";

function simulatedProvider(output: unknown = VALID_OUTPUT): AssessmentProviderPort {
  return createSimulatedAssessmentProvider({
    output,
    model: "simulated-underwriter",
    promptVersion: "prompt-v1",
    now: () => FIXED_NOW
  });
}

/** A zero-delay policy: exercises the retry control flow without a real wait. */
const FAST_RETRY: AssessmentRetryPolicy = {
  maxAttempts: 2,
  initialBackoffMs: 0,
  maxBackoffMs: 0
};

const OK_OUTCOME: Extract<AssessmentProviderOutcome, { ok: true }> = {
  ok: true,
  rawOutput: VALID_OUTPUT,
  metadata: {
    model: "counting-provider",
    promptVersion: "prompt-v1",
    generatedAt: FIXED_NOW,
    source: "provider"
  }
};

/**
 * A provider that answers from a script and records how many times it ran.
 * The call count is the whole point of the retry contract: an assertion on the
 * result alone could not tell "retried once" from "retried forever".
 */
function countingProvider(outcomeForCall: (call: number) => AssessmentProviderOutcome): {
  readonly provider: AssessmentProviderPort;
  readonly calls: () => number;
} {
  let calls = 0;

  return {
    provider: {
      assess: async (): Promise<AssessmentProviderOutcome> => {
        calls += 1;
        return outcomeForCall(calls);
      }
    },
    calls: () => calls
  };
}

describe("runAssessment", () => {
  it("returns the validated assessment together with the model and prompt metadata", async () => {
    const result = await runAssessment(simulatedProvider(), { evidence: EVIDENCE });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.assessment.riskBand).toBe("medium");
    expect(result.value.assessment.confidence).toBe(0.72);
    expect(result.value.metadata).toEqual({
      model: "simulated-underwriter",
      promptVersion: "prompt-v1",
      generatedAt: FIXED_NOW,
      source: "simulated"
    });
  });

  it("labels a simulated provider as simulated, so it cannot pass for a real evaluation", async () => {
    const result = await runAssessment(simulatedProvider(), { evidence: EVIDENCE });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.metadata.source).toBe("simulated");
  });

  it("sends only the supplied evidence, and derives the citable references from it", async () => {
    let received: unknown;
    const spy: AssessmentProviderPort = {
      assess: async (input) => {
        received = input;
        return {
          ok: true,
          rawOutput: VALID_OUTPUT,
          metadata: {
            model: "spy",
            promptVersion: "prompt-v1",
            generatedAt: FIXED_NOW,
            source: "provider"
          }
        };
      }
    };

    const result = await runAssessment(spy, { evidence: EVIDENCE });

    expect(result.ok).toBe(true);
    expect(received).toEqual({ evidence: EVIDENCE });
    expect(citableReferences(EVIDENCE)).toEqual([
      "sales:2026-01",
      "sales:2026-06",
      "missing:2026-04"
    ]);
  });

  it("rejects an output citing evidence the model was never given", async () => {
    const result = await runAssessment(
      simulatedProvider({
        ...VALID_OUTPUT,
        reasons: [{ claim: "Las ventas crecieron", evidenceRefs: ["sales:2025-12"] }]
      }),
      { evidence: EVIDENCE }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toEqual({
      code: "unknown_evidence_reference",
      violations: [
        { code: "unknown_evidence_reference", reference: "sales:2025-12", path: "reasons.0" }
      ]
    });
  });

  it("rejects an output that does not satisfy the contract, and never reports success", async () => {
    const result = await runAssessment(simulatedProvider({ ...VALID_OUTPUT, confidence: 72 }), {
      evidence: EVIDENCE
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toEqual({ code: "invalid_output" });
  });

  it("maps a provider that never answers to a timeout", async () => {
    const silent: AssessmentProviderPort = { assess: () => new Promise(() => {}) };

    const result = await runAssessment(silent, { evidence: EVIDENCE, timeoutMs: 20 });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toEqual({ code: "timeout" });
  });

  it("maps a provider failure to a sanitized typed error", async () => {
    const failing = createSimulatedAssessmentProvider({
      output: VALID_OUTPUT,
      failWith: "provider_unavailable",
      now: () => FIXED_NOW
    });

    const result = await runAssessment(failing, { evidence: EVIDENCE });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toEqual({ code: "provider_unavailable" });
  });

  it("maps a provider-reported timeout to a timeout", async () => {
    const timingOut = createSimulatedAssessmentProvider({
      output: VALID_OUTPUT,
      failWith: "timeout",
      now: () => FIXED_NOW
    });

    const result = await runAssessment(timingOut, { evidence: EVIDENCE });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toEqual({ code: "timeout" });
  });
});

describe("bounded provider retry (Feature #31)", () => {
  it("retries a provider_unavailable once and succeeds on the second attempt", async () => {
    const counting = countingProvider((call) =>
      call === 1 ? { ok: false, error: { code: "provider_unavailable" } } : OK_OUTCOME
    );

    const result = await runAssessment(counting.provider, {
      evidence: EVIDENCE,
      retry: FAST_RETRY
    });

    expect(result.ok).toBe(true);
    expect(counting.calls()).toBe(2);
  });

  it("gives up after the default attempt budget and returns provider_unavailable", async () => {
    const counting = countingProvider(() => ({ ok: false, error: { code: "provider_unavailable" } }));

    // No explicit retry: the production default of two attempts applies.
    const result = await runAssessment(counting.provider, { evidence: EVIDENCE });

    expect(result).toEqual({ ok: false, error: { code: "provider_unavailable" } });
    expect(counting.calls()).toBe(2);
  });

  it("never retries a provider-reported timeout: it is terminal", async () => {
    const counting = countingProvider(() => ({ ok: false, error: { code: "timeout" } }));

    const result = await runAssessment(counting.provider, {
      evidence: EVIDENCE,
      retry: FAST_RETRY
    });

    expect(result).toEqual({ ok: false, error: { code: "timeout" } });
    expect(counting.calls()).toBe(1);
  });

  it("never retries a provider that the boundary itself times out", async () => {
    let calls = 0;
    const silent: AssessmentProviderPort = {
      assess: () => {
        calls += 1;
        return new Promise(() => {});
      }
    };

    const result = await runAssessment(silent, {
      evidence: EVIDENCE,
      timeoutMs: 20,
      retry: FAST_RETRY
    });

    expect(result).toEqual({ ok: false, error: { code: "timeout" } });
    expect(calls).toBe(1);
  });

  it("never retries a validation failure: an invalid output is not a transient break", async () => {
    const counting = countingProvider(() => ({
      ...OK_OUTCOME,
      rawOutput: { ...VALID_OUTPUT, confidence: 72 }
    }));

    const result = await runAssessment(counting.provider, {
      evidence: EVIDENCE,
      retry: FAST_RETRY
    });

    expect(result).toEqual({ ok: false, error: { code: "invalid_output" } });
    expect(counting.calls()).toBe(1);
  });

  it("does not retry at all when the policy allows a single attempt", async () => {
    const counting = countingProvider(() => ({ ok: false, error: { code: "provider_unavailable" } }));

    const result = await runAssessment(counting.provider, {
      evidence: EVIDENCE,
      retry: { maxAttempts: 1, initialBackoffMs: 0, maxBackoffMs: 0 }
    });

    expect(result).toEqual({ ok: false, error: { code: "provider_unavailable" } });
    expect(counting.calls()).toBe(1);
  });

  it("returns only the sanitized code even when the provider attaches extra fields", async () => {
    const counting = countingProvider(
      () =>
        ({
          ok: false,
          error: { code: "provider_unavailable", message: "SECRET", retryAfterMs: 5_000 }
        }) as unknown as AssessmentProviderOutcome
    );

    const result = await runAssessment(counting.provider, {
      evidence: EVIDENCE,
      retry: FAST_RETRY
    });

    expect(result).toEqual({ ok: false, error: { code: "provider_unavailable" } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(counting.calls()).toBe(2);
  });
});
