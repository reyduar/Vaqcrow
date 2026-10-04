import { describe, expect, it } from "vitest";
import { SimulatedWalletBalanceAdapter } from "./simulated-wallet-balance-adapter";

describe("SimulatedWalletBalanceAdapter", () => {
  it("reports an unfunded Testnet account without touching the network", async () => {
    expect(await new SimulatedWalletBalanceAdapter().getBalance("GBXK1234567890ABCD7Q2M")).toEqual({
      ok: true,
      balanceXlm: "0.0000000"
    });
  });
});
