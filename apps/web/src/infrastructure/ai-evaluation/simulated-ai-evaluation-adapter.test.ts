import { afterEach, describe, expect, it, vi } from "vitest";
import { SimulatedAiEvaluationAdapter } from "./simulated-ai-evaluation-adapter";

afterEach(() => {
  vi.useRealTimers();
});

describe("SimulatedAiEvaluationAdapter", () => {
  it("resolves the deterministic medium band with the four template checks", async () => {
    const adapter = new SimulatedAiEvaluationAdapter(0);

    const result = await adapter.evaluate({ smeReference: "30712345678", sales: [] });

    expect(result.riskBand).toBe("medium");
    expect(result.checks.map((check) => check.title)).toEqual([
      "Identidad y empresa",
      "Ventas declaradas",
      "Faltante",
      "Anomalía"
    ]);
  });

  it("waits for the injectable delay before resolving", async () => {
    vi.useFakeTimers();
    const adapter = new SimulatedAiEvaluationAdapter(2200);
    let settled = false;

    const pending = adapter.evaluate({ smeReference: "30712345678", sales: [] }).then((result) => {
      settled = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1300);
    expect(settled).toBe(true);
    await expect(pending).resolves.toMatchObject({ riskBand: "medium" });
  });

  it("defaults to the template's ~2200 ms delay", async () => {
    vi.useFakeTimers();
    const adapter = new SimulatedAiEvaluationAdapter();
    let settled = false;
    const pending = adapter.evaluate({ smeReference: "x", sales: [] }).then((result) => {
      settled = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(2199);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    await pending;
  });
});
