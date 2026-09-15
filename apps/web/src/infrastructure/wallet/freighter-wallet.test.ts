import { describe, expect, it } from "vitest";
import { FreighterWallet } from "./freighter-wallet";

describe("FreighterWallet", () => {
  it("rejects 'not implemented' when checking availability", async () => {
    const wallet = new FreighterWallet();

    await expect(wallet.isAvailable()).rejects.toThrow("not implemented");
  });

  it("rejects 'not implemented' when connecting", async () => {
    const wallet = new FreighterWallet();

    await expect(wallet.connect()).rejects.toThrow("not implemented");
  });

  it("rejects 'not implemented' when signing a transaction", async () => {
    const wallet = new FreighterWallet();

    await expect(wallet.signTransaction("xdr-payload", "Test SDF Network ; September 2015")).rejects.toThrow(
      "not implemented"
    );
  });
});
