import { describe, expect, it } from "vitest";
import type { CompletenessCheckInput } from "../../application/completeness/completeness-check.js";
import { createDeterministicCompletenessCheckAdapter } from "./deterministic-completeness-check-adapter.js";

const COMPLETE_INPUT: CompletenessCheckInput = {
  documents: [
    { kind: "sales-declarations", present: true },
    { kind: "cuit", present: true },
    { kind: "articles-of-incorporation", present: true }
  ],
  photoCount: 2,
  salesMonths: [
    { month: "Enero", valueArs: 3_100_000 },
    { month: "Febrero", valueArs: 3_200_000 },
    { month: "Marzo", valueArs: 3_300_000 },
    { month: "Abril", valueArs: 3_400_000 },
    { month: "Mayo", valueArs: 3_500_000 },
    { month: "Junio", valueArs: 3_600_000 }
  ]
};

describe("createDeterministicCompletenessCheckAdapter", () => {
  it("implements the port and resolves the pure check result", async () => {
    const adapter = createDeterministicCompletenessCheckAdapter();

    await expect(adapter.check(COMPLETE_INPUT)).resolves.toEqual({ complete: true, findings: [] });
  });

  it("is deterministic: the same input yields the same result", async () => {
    const adapter = createDeterministicCompletenessCheckAdapter();
    const incomplete: CompletenessCheckInput = { ...COMPLETE_INPUT, photoCount: 0 };

    const first = await adapter.check(incomplete);
    const second = await adapter.check(incomplete);

    expect(first).toEqual(second);
    expect(first.complete).toBe(false);
    expect(first.findings.map((finding) => finding.code)).toContain("insufficient_photos");
  });
});
