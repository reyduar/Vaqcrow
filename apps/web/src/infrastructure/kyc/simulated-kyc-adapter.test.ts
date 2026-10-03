import { afterEach, describe, expect, it, vi } from "vitest";
import { SIMULATED_KYC_DELAY_MS, SimulatedKycAdapter } from "./simulated-kyc-adapter";

afterEach(() => {
  vi.useRealTimers();
});

describe("SimulatedKycAdapter", () => {
  it("uses the template's provider label and a ~1300 ms default delay", () => {
    expect(SIMULATED_KYC_DELAY_MS).toBe(1300);
  });

  it("approves the responsible person deterministically", async () => {
    const adapter = new SimulatedKycAdapter(0);
    await expect(adapter.verify({ document: "person_a" })).resolves.toEqual({
      outcome: "approved",
      reference: "kyc:PH-2026-0001",
      provider: "Adaptador KYC simulado v1"
    });
  });

  it("asks for changes for the partner, deterministically", async () => {
    const adapter = new SimulatedKycAdapter(0);
    await expect(adapter.verify({ document: "person_b" })).resolves.toEqual({
      outcome: "requires_changes",
      reference: "kyc:PH-2026-0002",
      provider: "Adaptador KYC simulado v1"
    });
  });

  it("returns the same result across calls (no randomness, no clock)", async () => {
    const adapter = new SimulatedKycAdapter(0);
    const first = await adapter.verify({ document: "person_a" });
    const second = await adapter.verify({ document: "person_a" });
    expect(second).toEqual(first);
  });

  it("does not resolve before the injected delay elapses", async () => {
    vi.useFakeTimers();
    const adapter = new SimulatedKycAdapter(1300);
    const pending = adapter.verify({ document: "person_a" });
    const resolved = vi.fn();
    void pending.then(resolved);

    await vi.advanceTimersByTimeAsync(1299);
    expect(resolved).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toMatchObject({ outcome: "approved" });
    expect(resolved).toHaveBeenCalledTimes(1);
  });
});
