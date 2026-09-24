import { describe, expect, it } from "vitest";
import { mapVaultStateToCampaignState, toChainCampaignSnapshot } from "./campaign-vault-chain-port.js";
import type { VaultChainState } from "./campaign-vault-chain-port.js";

describe("mapVaultStateToCampaignState", () => {
  it("maps the contract's vocabulary to the mirror's own", () => {
    expect(mapVaultStateToCampaignState("funding")).toBe("open");
    expect(mapVaultStateToCampaignState("settled")).toBe("settled");
    expect(mapVaultStateToCampaignState("refunding")).toBe("refundable");
  });
});

describe("toChainCampaignSnapshot", () => {
  it("builds a ChainCampaignSnapshot from a chain read and gathered contributions", () => {
    const observedAt = new Date("2026-09-24T12:00:00.000Z");
    const state: VaultChainState = {
      state: "funding",
      totalStroops: 500_0000000n,
      goalStroops: 1000_0000000n,
      deadline: new Date("2026-12-01T00:00:00.000Z"),
      smeAccountId: "GA".padEnd(56, "A"),
      tokenContractId: "CA".padEnd(56, "A"),
      observedAt
    };

    const snapshot = toChainCampaignSnapshot(state, [
      { investorAccountId: "GB".padEnd(56, "B"), amountStroops: 500_0000000n, lastObservedAt: observedAt.toISOString() }
    ]);

    expect(snapshot).toEqual({
      state: "open",
      totalStroops: 500_0000000n,
      observedAt: observedAt.toISOString(),
      contributions: [
        { investorAccountId: "GB".padEnd(56, "B"), amountStroops: 500_0000000n, lastObservedAt: observedAt.toISOString() }
      ]
    });
  });
});
