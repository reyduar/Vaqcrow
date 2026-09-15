import type { LedgerPort } from "../../application/ports/ledger-port.js";

export class StellarLedger implements LedgerPort {
  getBalance(): Promise<unknown> {
    throw new Error("not implemented");
  }
}
