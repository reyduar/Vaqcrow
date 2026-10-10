import { describe, expect, it } from "vitest";
import type { WalletBalancePort } from "@/application/ports/wallet-balance-port";
import { SimulatedWalletBalanceAdapter } from "./simulated-wallet-balance-adapter";

describe("SimulatedWalletBalanceAdapter", () => {
  it("reports an unfunded Testnet account without touching the network", async () => {
    // Read through the port, which declares the `publicKey` the container passes;
    // the simulated adapter ignores it and never reaches the network.
    const port: WalletBalancePort = new SimulatedWalletBalanceAdapter();
    expect(await port.getBalance("GBXK1234567890ABCD7Q2M")).toEqual({
      ok: true,
      balanceXlm: "0.0000000"
    });
  });
});
