import { describe, expect, it } from "vitest";
import { parseAssessmentFailureHandoffCommand } from "./assessment-failure-handoff.js";

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

describe("Assessment failure handoff contract", () => {
  it("admits only the validated evidence, sanitized failure code, correlation id, and valid provenance", () => {
    const command = parseAssessmentFailureHandoffCommand({
      applicationId: "11111111-1111-4111-8111-111111111111",
      correlationId: "22222222-2222-4222-8222-222222222222",
      failureCode: "invalid_output",
      evidence,
      providerProvenance: {
        model: "simulated-underwriter",
        promptVersion: "prompt-v1",
        generatedAt: "2026-09-28T12:00:00.000Z",
        source: "simulated"
      }
    });

    expect(command).toEqual({
      applicationId: "11111111-1111-4111-8111-111111111111",
      correlationId: "22222222-2222-4222-8222-222222222222",
      failureCode: "invalid_output",
      evidence,
      providerProvenance: {
        model: "simulated-underwriter",
        promptVersion: "prompt-v1",
        generatedAt: "2026-09-28T12:00:00.000Z",
        source: "simulated"
      }
    });
  });

  it("rejects raw vendor output, errors, secrets, PII, seeds, and arbitrary provenance metadata", () => {
    const base = {
      applicationId: "11111111-1111-4111-8111-111111111111",
      correlationId: "22222222-2222-4222-8222-222222222222",
      failureCode: "provider_unavailable",
      evidence
    };

    for (const forbidden of [
      { rawOutput: { recommendation: "approve" } },
      { vendorError: { message: "token=secret" } },
      { apiKey: "secret" },
      { customerEmail: "owner@example.test" },
      { seed: "wallet recovery phrase" },
      {
        providerProvenance: {
          model: "simulated-underwriter",
          promptVersion: "prompt-v1",
          generatedAt: "2026-09-28T12:00:00.000Z",
          source: "simulated",
          vendorTrace: "arbitrary"
        }
      }
    ]) {
      expect(() => parseAssessmentFailureHandoffCommand({ ...base, ...forbidden })).toThrow();
    }
  });

  it("admits every closed-set failure code and rejects anything outside it", () => {
    const base = {
      applicationId: "11111111-1111-4111-8111-111111111111",
      correlationId: "22222222-2222-4222-8222-222222222222",
      evidence
    };

    for (const failureCode of [
      "timeout",
      "provider_unavailable",
      "invalid_output",
      "unknown_evidence_reference"
    ]) {
      expect(parseAssessmentFailureHandoffCommand({ ...base, failureCode }).failureCode).toBe(failureCode);
    }

    for (const forbidden of ["rate_limited", "internal_error", "provider 500", "raw vendor message"]) {
      expect(() => parseAssessmentFailureHandoffCommand({ ...base, failureCode: forbidden })).toThrow();
    }
  });

  it("omits provider provenance when no valid provenance was supplied", () => {
    const command = parseAssessmentFailureHandoffCommand({
      applicationId: "11111111-1111-4111-8111-111111111111",
      correlationId: "22222222-2222-4222-8222-222222222222",
      failureCode: "timeout",
      evidence
    });

    expect(command.providerProvenance).toBeUndefined();
    expect(command).not.toHaveProperty("providerProvenance");
  });
});
