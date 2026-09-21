import { Horizon } from "@stellar/stellar-sdk";
import type { StellarConfig } from "../../application/config/stellar-config.js";

/**
 * The one place a Horizon server is constructed from validated configuration.
 *
 * Two adapters now talk to Horizon — `StellarLedger` reads public accounts and
 * `StellarTransaction` submits and reads back transactions — and both must
 * inherit the same network boundary rather than re-deciding it. The config is
 * already closed to Testnet by `#14`, so neither adapter can be pointed at a
 * network the rest of the process has not accepted.
 *
 * `#14` admits a loopback Horizon over plain HTTP so a local double can stand in
 * for Testnet. The SDK refuses an insecure URL unless the caller says it meant
 * it, so the scheme decides — and only the scheme `#14` already validated can
 * reach here.
 */
export function createHorizonServer(config: StellarConfig): Horizon.Server {
  return new Horizon.Server(config.horizonUrl, {
    allowHttp: usesPlainHttp(config.horizonUrl)
  });
}

/** `https://` does not match this prefix; only a genuinely plain-HTTP URL does. */
export function usesPlainHttp(url: string): boolean {
  return url.startsWith("http://");
}
