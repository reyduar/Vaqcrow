import { Horizon } from "@stellar/stellar-sdk";
import { isLoopbackHost, STELLAR_LOCAL_NETWORK } from "../../application/config/stellar-config.js";
import type { StellarConfig, StellarNetwork } from "../../application/config/stellar-config.js";

/**
 * The one place a Horizon server is constructed from validated configuration.
 *
 * Two adapters now talk to Horizon — `StellarLedger` reads public accounts and
 * `StellarTransaction` submits and reads back transactions — and both must
 * inherit the same network boundary rather than re-deciding it. The config is
 * already closed to Testnet (or, since U1, to `local` under `APP_ENV=local`)
 * by `#14`/`#237`, so neither adapter can be pointed at a network the rest of
 * the process has not accepted.
 *
 * `#14` admits a loopback Horizon over plain HTTP so a local double can stand in
 * for Testnet. The SDK refuses an insecure URL unless the caller says it meant
 * it, so the scheme decides — and only the scheme `#14` already validated can
 * reach here.
 */
export function createHorizonServer(config: StellarConfig): Horizon.Server {
  return new Horizon.Server(config.horizonUrl, {
    allowHttp: usesPlainHttp(config)
  });
}

/**
 * `https://` never matches this, so it only ever admits a genuinely
 * plain-HTTP URL. Beyond that, plain HTTP is allowed on two axes:
 *
 *   - **Loopback**, on any network — the concession `#14` already made for a
 *     local Horizon double standing in for Testnet.
 *   - **The `local` network**, regardless of host — `#237`'s Quickstart
 *     container is reached over plain HTTP from a non-loopback host too (the
 *     API container talks to it via `http://host.docker.internal:8000`), and
 *     `stellar-config.ts` already closed `local` to `APP_ENV=local` before
 *     this function ever sees the config, so widening the host here adds no
 *     new boundary to defend.
 *
 * Testnet against a non-loopback host stays refused: `stellar-config.ts`
 * only lets a non-loopback Testnet Horizon URL through as `https:`, so that
 * combination cannot legitimately reach here as plain HTTP in the first
 * place — this is defense in depth, not the primary boundary.
 */
export function usesPlainHttp(config: StellarConfig): boolean {
  return allowsPlainHttp(config.horizonUrl, config.network);
}

/**
 * The plain-HTTP boundary itself, taking a URL directly rather than a whole
 * `StellarConfig` — `soroban-rpc.ts` reuses this exact rule for `config.rpcUrl`
 * instead of re-deciding the same two axes (loopback, or the `local` network)
 * for a second URL field. See {@link usesPlainHttp} for the reasoning; this is
 * that same boundary, generalised over which validated URL it is applied to.
 */
export function allowsPlainHttp(url: string, network: StellarNetwork): boolean {
  if (!url.startsWith("http://")) {
    return false;
  }

  if (network === STELLAR_LOCAL_NETWORK) {
    return true;
  }

  return isLoopbackHost(safeHostname(url));
}

/** The URL was already validated by `stellar-config.ts`, so a parse failure here is unreachable in practice — this is a defensive fallback, not a new validation path. */
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
