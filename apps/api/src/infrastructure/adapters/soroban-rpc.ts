import { rpc } from "@stellar/stellar-sdk";
import { allowsPlainHttp } from "./stellar-horizon.js";
import type { StellarConfig } from "../../application/config/stellar-config.js";

/**
 * The one place a Soroban RPC server is constructed from validated
 * configuration — the RPC analogue of `createHorizonServer` in
 * `stellar-horizon.ts`. `stellar-campaign-vault-chain.ts` and
 * `stellar-campaign-vault-invocation.ts` both depend on this rather than
 * constructing `rpc.Server` themselves, so neither can drift from the other's
 * `allowHttp` decision.
 */
export function createSorobanRpcServer(config: StellarConfig): rpc.Server {
  return new rpc.Server(config.rpcUrl, {
    allowHttp: usesPlainHttp(config)
  });
}

/**
 * `config.rpcUrl` is validated by `stellar-config.ts` under exactly the same
 * two axes as `config.horizonUrl` (loopback, or the `local` network), so this
 * reuses `stellar-horizon.ts`'s `allowsPlainHttp` rather than re-deciding the
 * boundary for a second URL field.
 */
export function usesPlainHttp(config: StellarConfig): boolean {
  return allowsPlainHttp(config.rpcUrl, config.network);
}
