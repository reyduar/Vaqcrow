import type { WalletBalancePort, WalletBalanceResult } from "@/application/ports/wallet-balance-port";

/**
 * Deterministic balance for the demo wallet card (Feature #406, Task #407 /
 * T1c). The connected Testnet account is treated as unfunded — the owner's
 * named case (`#406` decision 1) — so the card shows `0.0000000 XLM` without
 * reaching Horizon. A live Horizon adapter (over `fetch`, since the boundary
 * rule keeps the Stellar SDK out of the browser bundle) is a later unit; until
 * then no pull-request verification can depend on a network endpoint.
 */
export class SimulatedWalletBalanceAdapter implements WalletBalancePort {
  async getBalance(): Promise<WalletBalanceResult> {
    return { ok: true, balanceXlm: "0.0000000" };
  }
}
