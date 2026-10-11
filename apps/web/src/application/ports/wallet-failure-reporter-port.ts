import type { WalletFailureEvent } from "@vaqcrow/contracts";

/**
 * Reports a wallet failure to the backend (#31, WU4b).
 *
 * The web is the only side that can see Freighter, so it classifies the failure
 * and reports the closed, text-free `WalletFailureEvent` — never the wallet's
 * own message, a public key or an XDR. Lives with the ports so `application/`
 * can depend on it without importing infrastructure.
 *
 * Telemetry is strictly best-effort: a report must never change what the wallet
 * does, and must never surface to the caller.
 */
export interface WalletFailureReporterPort {
  /** Fire-and-forget. Must never throw and must never block the caller. */
  report(event: WalletFailureEvent): void;
}
