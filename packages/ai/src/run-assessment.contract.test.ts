import { describe, expect, it } from "vitest";
import {
  citableReferences,
  createSimulatedAssessmentProvider,
  parseAssessmentEvidenceBundle,
  runAssessment
} from "./index.js";
import type {
  AssessmentEvidenceBundle,
  AssessmentMetadata,
  AssessmentProviderOutcome,
  AssessmentProviderPort
} from "./index.js";

/**
 * Contract and timeout matrix for the provider boundary (Feature #21, Task #69).
 *
 * Task #68 established the boundary with a focused set. This is the matrix:
 * the same conformance suite run against every implementation, the timeout
 * boundaries, and the guarantee that no failure mode leaks a provider's own
 * error text or passes for a success.
 *
 * `DEMO.md` §11 expects "Fake-provider contract and timeout tests"; every
 * scenario here runs against local doubles, with no live provider reachable.
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

/** A finding that carries no reference: it must contribute nothing citable. */
const FINDING_WITHOUT_REFERENCE = {
  kind: "contradictory",
  messageKey: "sales.series.contradictory"
} as const;

const FINDING_APRIL = {
  kind: "missing",
  period: "2026-04",
  evidenceRef: "missing:2026-04",
  messageKey: "sales.period.missing"
} as const;

const EVIDENCE: AssessmentEvidenceBundle = {
  periods: [JANUARY, JUNE, APRIL],
  findings: [FINDING_APRIL, FINDING_WITHOUT_REFERENCE]
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

const HAND_WRITTEN_METADATA: AssessmentMetadata = {
  model: "hand-written-provider",
  promptVersion: "prompt-v9",
  generatedAt: FIXED_NOW,
  source: "provider"
};

/**
 * Every implementation of the port must be indistinguishable to the caller.
 * Running one suite against all of them is what "provider stays replaceable"
 * actually means; asserting it once against a single provider would not.
 */
const CONFORMING_PROVIDERS: readonly {
  readonly name: string;
  readonly build: (output: unknown) => AssessmentProviderPort;
}[] = [
  {
    name: "the simulated provider",
    build: (output) =>
      createSimulatedAssessmentProvider({ output, now: () => FIXED_NOW })
  },
  {
    name: "a hand-written provider",
    build: (output) => ({
      assess: async (): Promise<AssessmentProviderOutcome> => ({
        ok: true,
        rawOutput: output,
        metadata: HAND_WRITTEN_METADATA
      })
    })
  }
];

describe.each(CONFORMING_PROVIDERS)("provider conformance: $name", ({ build }) => {
  it("returns the validated assessment for a well-formed output", async () => {
    const result = await runAssessment(build(VALID_OUTPUT), { evidence: EVIDENCE });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.assessment.riskBand).toBe("medium");
    expect(result.value.assessment.recommendedAction).toBe("human_review");
  });

  it("preserves the provider's own metadata verbatim", async () => {
    const result = await runAssessment(build(VALID_OUTPUT), { evidence: EVIDENCE });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.metadata.promptVersion).toBeDefined();
    expect(result.value.metadata.generatedAt).toBe(FIXED_NOW);
  });

  it("rejects an output citing evidence the provider was never given", async () => {
    const result = await runAssessment(
      build({
        ...VALID_OUTPUT,
        reasons: [{ claim: "Inventada", evidenceRefs: ["sales:2025-12"] }]
      }),
      { evidence: EVIDENCE }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unknown_evidence_reference");
  });

  it("rejects an output that does not satisfy the assessment contract", async () => {
    const result = await runAssessment(build({ ...VALID_OUTPUT, confidence: 72 }), {
      evidence: EVIDENCE
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toEqual({ code: "invalid_output" });
  });
});

describe("timeout boundaries", () => {
  it("bounds a provider that never answers", async () => {
    const silent: AssessmentProviderPort = { assess: () => new Promise(() => {}) };

    const result = await runAssessment(silent, { evidence: EVIDENCE, timeoutMs: 20 });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toEqual({ code: "timeout" });
  });

  it("bounds a provider that answers after the deadline", async () => {
    const slow = createSimulatedAssessmentProvider({
      output: VALID_OUTPUT,
      delayMs: 250,
      now: () => FIXED_NOW
    });

    const result = await runAssessment(slow, { evidence: EVIDENCE, timeoutMs: 20 });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toEqual({ code: "timeout" });
  });

  it("accepts a provider that answers before the deadline", async () => {
    const quick = createSimulatedAssessmentProvider({
      output: VALID_OUTPUT,
      delayMs: 0,
      now: () => FIXED_NOW
    });

    const result = await runAssessment(quick, { evidence: EVIDENCE, timeoutMs: 2_000 });

    expect(result.ok).toBe(true);
  });

  it("maps a provider-reported timeout to a timeout", async () => {
    const reporting = createSimulatedAssessmentProvider({
      output: VALID_OUTPUT,
      failWith: "timeout",
      now: () => FIXED_NOW
    });

    const result = await runAssessment(reporting, { evidence: EVIDENCE });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toEqual({ code: "timeout" });
  });

  it("does not wait for the timer when the provider answers immediately", async () => {
    const quick = createSimulatedAssessmentProvider({ output: VALID_OUTPUT, now: () => FIXED_NOW });
    const startedAt = Date.now();

    const result = await runAssessment(quick, { evidence: EVIDENCE, timeoutMs: 5_000 });
    const elapsed = Date.now() - startedAt;

    expect(result.ok).toBe(true);
    // A cleared timer is the difference between a fast response and a hung
    // caller holding a five-second deadline it never needed.
    expect(elapsed).toBeLessThan(1_500);
  });
});

describe("failure sanitization", () => {
  const LEAKY_MESSAGE = "provider exploded: token sk-live-abc123 at /internal/path";

  it("never leaks a thrown provider's message", async () => {
    const throwing: AssessmentProviderPort = {
      assess: () => Promise.reject(new Error(LEAKY_MESSAGE))
    };

    const result = await runAssessment(throwing, { evidence: EVIDENCE });

    expect(result).toEqual({ ok: false, error: { code: "provider_unavailable" } });
    expect(JSON.stringify(result)).not.toContain("sk-live-abc123");
    expect(JSON.stringify(result)).not.toContain("/internal/path");
  });

  it("never leaks a non-Error rejection", async () => {
    const throwing: AssessmentProviderPort = {
      assess: () => Promise.reject(LEAKY_MESSAGE)
    };

    const result = await runAssessment(throwing, { evidence: EVIDENCE });

    expect(result).toEqual({ ok: false, error: { code: "provider_unavailable" } });
  });

  it("never passes through extra fields a provider attaches to its own error", async () => {
    const chatty: AssessmentProviderPort = {
      assess: async () =>
        ({
          ok: false,
          error: { code: "provider_unavailable", message: LEAKY_MESSAGE, retryAfterMs: 5_000 }
        }) as unknown as AssessmentProviderOutcome
    };

    const result = await runAssessment(chatty, { evidence: EVIDENCE });

    expect(result).toEqual({ ok: false, error: { code: "provider_unavailable" } });
    expect(JSON.stringify(result)).not.toContain("sk-live-abc123");
  });

  it("sanitizes a thrown provider on the timeout path too", async () => {
    const throwingSlowly: AssessmentProviderPort = {
      assess: () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error(LEAKY_MESSAGE)), 5))
    };

    const result = await runAssessment(throwingSlowly, { evidence: EVIDENCE, timeoutMs: 500 });

    expect(result).toEqual({ ok: false, error: { code: "provider_unavailable" } });
  });

  it("rejects metadata a provider augmented beyond the declared shape", async () => {
    const chatty: AssessmentProviderPort = {
      assess: async () =>
        ({
          ok: true,
          rawOutput: VALID_OUTPUT,
          metadata: { ...HAND_WRITTEN_METADATA, vendorTrace: LEAKY_MESSAGE }
        }) as unknown as AssessmentProviderOutcome
    };

    const result = await runAssessment(chatty, { evidence: EVIDENCE });

    expect(result).toEqual({ ok: false, error: { code: "invalid_output" } });
    expect(JSON.stringify(result)).not.toContain("sk-live-abc123");
  });
});

describe("evidence boundary", () => {
  it("sends the evidence bundle and nothing else", async () => {
    let received: unknown;
    const spy: AssessmentProviderPort = {
      assess: async (input) => {
        received = input;
        return { ok: true, rawOutput: VALID_OUTPUT, metadata: HAND_WRITTEN_METADATA };
      }
    };

    await runAssessment(spy, { evidence: EVIDENCE });

    expect(Object.keys(received as Record<string, unknown>)).toEqual(["evidence"]);
    expect((received as { evidence: unknown }).evidence).toBe(EVIDENCE);
  });

  it("deduplicates citable references and ignores a finding that carries none", () => {
    expect(citableReferences(EVIDENCE)).toEqual([
      "sales:2026-01",
      "sales:2026-06",
      "missing:2026-04"
    ]);
  });

  it("accepts a citation to a reference that only a finding supplies", async () => {
    const result = await runAssessment(
      createSimulatedAssessmentProvider({
        output: {
          ...VALID_OUTPUT,
          missingData: [],
          reasons: [{ claim: "Abril no fue declarado", evidenceRefs: ["missing:2026-04"] }],
          anomalies: []
        },
        now: () => FIXED_NOW
      }),
      { evidence: EVIDENCE }
    );

    expect(result.ok).toBe(true);
  });

  it("rejects a bundle with no periods", () => {
    expect(() => parseAssessmentEvidenceBundle({ periods: [], findings: [] })).toThrow();
  });

  it("rejects an evidence period carrying a field the shared contract does not declare", () => {
    expect(() =>
      parseAssessmentEvidenceBundle({
        periods: [{ ...JANUARY, internalNote: "not part of the contract" }],
        findings: []
      })
    ).toThrow();
  });
});

describe("invalid output matrix", () => {
  const MALFORMED: readonly { readonly name: string; readonly output: unknown }[] = [
    { name: "a confidence above 1", output: { ...VALID_OUTPUT, confidence: 72 } },
    { name: "a negative confidence", output: { ...VALID_OUTPUT, confidence: -0.1 } },
    { name: "a risk band outside its enum", output: { ...VALID_OUTPUT, riskBand: "critical" } },
    { name: "an action outside the closed set", output: { ...VALID_OUTPUT, recommendedAction: "approved" } },
    { name: "a tool-call channel smuggled in", output: { ...VALID_OUTPUT, toolCalls: [] } },
    { name: "no reasons at all", output: { ...VALID_OUTPUT, reasons: [] } },
    { name: "a reason citing nothing", output: { ...VALID_OUTPUT, reasons: [{ claim: "x", evidenceRefs: [] }] } },
    // A string that is not JSON. A string that *is* JSON is the shape a chat
    // provider actually returns, so it belongs on the accepted path — see the
    // normalization suite below. This case was previously mis-classified as
    // invalid, which was only tenable while no real provider existed.
    { name: "a string that is not JSON", output: "I am unable to assess this application." },
    { name: "null", output: null },
    { name: "an array", output: [VALID_OUTPUT] },
    { name: "a required field missing", output: { ...VALID_OUTPUT, riskBand: undefined } }
  ];

  it.each(MALFORMED)("maps $name to invalid_output", async ({ output }) => {
    const result = await runAssessment(createSimulatedAssessmentProvider({ output }), {
      evidence: EVIDENCE
    });

    expect(result).toEqual({ ok: false, error: { code: "invalid_output" } });
  });
});

describe("raw output normalization", () => {
  it("accepts the assessment when a chat provider delivers it as JSON text", async () => {
    // This is not a convenience: it is the only shape a real chat provider
    // returns. Without it the production adapter could never succeed.
    const result = await runAssessment(
      createSimulatedAssessmentProvider({ output: JSON.stringify(VALID_OUTPUT) }),
      { evidence: EVIDENCE }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.assessment.riskBand).toBe("medium");
  });

  it("does not strip a markdown fence to rescue a malformed answer", async () => {
    const fenced = ["```json", JSON.stringify(VALID_OUTPUT), "```"].join("\n");

    const result = await runAssessment(createSimulatedAssessmentProvider({ output: fenced }), {
      evidence: EVIDENCE
    });

    expect(result).toEqual({ ok: false, error: { code: "invalid_output" } });
  });

  it("still validates a JSON text answer against the evidence guardrail", async () => {
    const citingUnseen = JSON.stringify({
      ...VALID_OUTPUT,
      reasons: [{ claim: "Inventada", evidenceRefs: ["sales:2025-12"] }]
    });

    const result = await runAssessment(createSimulatedAssessmentProvider({ output: citingUnseen }), {
      evidence: EVIDENCE
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unknown_evidence_reference");
  });
});

describe("no failure path claims success", () => {
  const FAILING: readonly { readonly name: string; readonly provider: AssessmentProviderPort }[] = [
    {
      name: "an output citing unseen evidence",
      provider: createSimulatedAssessmentProvider({
        output: { ...VALID_OUTPUT, reasons: [{ claim: "x", evidenceRefs: ["nope:2026-01"] }] }
      })
    },
    {
      name: "an invalid output",
      provider: createSimulatedAssessmentProvider({ output: { ...VALID_OUTPUT, confidence: 72 } })
    },
    {
      name: "a provider-reported timeout",
      provider: createSimulatedAssessmentProvider({ output: VALID_OUTPUT, failWith: "timeout" })
    },
    {
      name: "an unavailable provider",
      provider: createSimulatedAssessmentProvider({
        output: VALID_OUTPUT,
        failWith: "provider_unavailable"
      })
    },
    { name: "a throwing provider", provider: { assess: () => Promise.reject(new Error("boom")) } }
  ];

  it.each(FAILING)("returns a failure and no assessment for $name", async ({ provider }) => {
    const result = await runAssessment(provider, { evidence: EVIDENCE });

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("value");
    if (result.ok) {
      return;
    }

    expect(["invalid_output", "unknown_evidence_reference", "timeout", "provider_unavailable"]).toContain(
      result.error.code
    );
  });
});
