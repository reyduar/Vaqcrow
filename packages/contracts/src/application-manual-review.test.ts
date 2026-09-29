import { describe, expect, it } from "vitest";
import { parseApplicationManualReviewContext } from "./application-manual-review.js";

const evidence = {
  periods: [
    {
      period: "2026-01",
      amountArs: 1_200_000,
      status: "reported",
      evidenceRef: "sales:2026-01",
      simuladoLabel: "SIMULADO"
    }
  ],
  findings: []
};

const base = {
  applicationId: "11111111-1111-4111-8111-111111111111",
  applicationState: "human_review",
  failureCode: "timeout",
  evidence,
  recordedAt: "2026-09-28T12:00:00.000Z"
};

describe("Application manual-review context contract", () => {
  it("admits the persisted sanitized failure context a browser renders, provenance included", () => {
    const context = parseApplicationManualReviewContext({
      ...base,
      providerProvenance: {
        model: "simulated-underwriter",
        promptVersion: "prompt-v1",
        generatedAt: "2026-09-28T12:00:00.000Z",
        source: "simulated"
      }
    });

    expect(context).toEqual({
      ...base,
      providerProvenance: {
        model: "simulated-underwriter",
        promptVersion: "prompt-v1",
        generatedAt: "2026-09-28T12:00:00.000Z",
        source: "simulated"
      }
    });
    // A simulated source stays labelled so the screen can never present it as real.
    expect(context.providerProvenance?.source).toBe("simulated");
  });

  it("omits provenance when none was declared (a timeout or an unavailable provider may have none)", () => {
    const context = parseApplicationManualReviewContext(base);

    expect(context).not.toHaveProperty("providerProvenance");
  });

  it("admits every closed-set failure code and rejects anything outside it", () => {
    for (const failureCode of [
      "timeout",
      "provider_unavailable",
      "invalid_output",
      "unknown_evidence_reference"
    ]) {
      expect(parseApplicationManualReviewContext({ ...base, failureCode }).failureCode).toBe(failureCode);
    }

    for (const forbidden of ["rate_limited", "internal_error", "provider 500", "raw vendor message"]) {
      expect(() => parseApplicationManualReviewContext({ ...base, failureCode: forbidden })).toThrow();
    }
  });

  it("rejects raw provider diagnostics, vendor errors, secrets, PII and seeds at every level", () => {
    for (const forbidden of [
      { rawOutput: { recommendation: "approve" } },
      { vendorError: { message: "token=secret" } },
      { apiKey: "secret" },
      { customerEmail: "owner@example.test" },
      { seed: "wallet recovery phrase" },
      { providerProvenance: { model: "m", promptVersion: "v", generatedAt: "2026-09-28T12:00:00.000Z", source: "simulated", vendorTrace: "arbitrary" } },
      { evidence: { periods: [{ ...evidence.periods[0], raw: "leak" }], findings: [] } }
    ]) {
      expect(() => parseApplicationManualReviewContext({ ...base, ...forbidden })).toThrow();
    }
  });

  it("rejects an unknown application state, an empty evidence series, and a malformed timestamp", () => {
    expect(() => parseApplicationManualReviewContext({ ...base, applicationState: "not_a_state" })).toThrow();
    expect(() =>
      parseApplicationManualReviewContext({ ...base, evidence: { periods: [], findings: [] } })
    ).toThrow();
    expect(() => parseApplicationManualReviewContext({ ...base, recordedAt: "yesterday" })).toThrow();
  });
});
