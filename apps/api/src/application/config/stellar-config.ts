import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import { invalidIssue, missingIssue, readPresent, unsupportedIssue } from "./env-source.js";
import type { EnvSource, ParseResult } from "./env-source.js";

/**
 * Stellar network boundary.
 *
 * The demo settles on Testnet by default, and the network is a closed set:
 * an unrecognised value is rejected by construction rather than by
 * convention. Requiring the value means the process cannot reach a chain
 * without a deliberate, validated declaration — a security boundary should
 * be opt-out, never opt-in.
 *
 * `local` (a Stellar Quickstart standalone network) joined the set for U1 so
 * later units can drive the campaign vault deterministically without
 * touching Testnet at all — but it is a *conditional* member: `local` is
 * only admitted when `APP_ENV=local` (D4 in
 * `odd/tasks/campaign-vault-web-journey.md`). Every other environment keeps
 * exactly the original single-member boundary, so a demo/preview/ci process
 * still cannot be pointed at anything but Testnet.
 *
 * The passphrases and Horizon/RPC URLs below are public constants, not
 * secrets: they are safe in source and in logs.
 */

export const SUPPORTED_STELLAR_NETWORK = "testnet" as const;
export const STELLAR_LOCAL_NETWORK = "local" as const;

/** The closed set `STELLAR_NETWORK` accepts, before the D4 environment gate. */
export const STELLAR_NETWORKS = [SUPPORTED_STELLAR_NETWORK, STELLAR_LOCAL_NETWORK] as const;
export type StellarNetwork = (typeof STELLAR_NETWORKS)[number];

export const STELLAR_TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";
export const STELLAR_TESTNET_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const STELLAR_TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";

/** Quickstart's own defaults: one container serving Horizon, RPC and Friendbot. */
export const STELLAR_LOCAL_HORIZON_URL = "http://localhost:8000";
export const STELLAR_LOCAL_RPC_URL = "http://localhost:8000/rpc";
export const STELLAR_LOCAL_NETWORK_PASSPHRASE = "Standalone Network ; February 2017";

/**
 * The canonical Testnet explorer, used when `STELLAR_EXPLORER_URL` is absent.
 *
 * `DEMO.md` §7 line 277 lists "URL del explorador" among the minimum variables, so
 * it is configurable — but a demo that forgot to set it should still produce a
 * working link rather than none.
 */
export const STELLAR_TESTNET_EXPLORER_URL = "https://stellar.expert/explorer/testnet";

const TESTNET_HORIZON_HOST = "horizon-testnet.stellar.org";
const TESTNET_RPC_HOST = "soroban-testnet.stellar.org";

export type StellarConfig = {
  readonly network: StellarNetwork;
  readonly horizonUrl: string;
  /** Soroban RPC endpoint — added for U1, consumed by the U3 contract adapters. */
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  /**
   * The base for a transaction link, without a trailing slash.
   *
   * Unlike `horizonUrl`, this is **not** closed to Testnet, and the difference is
   * deliberate: a Horizon endpoint decides where a signed envelope is submitted,
   * so pointing it at another network is a security boundary. An explorer base
   * only decides which page a hash opens, so a wrong one produces a broken link
   * and nothing else. Validating it as strictly as Horizon would buy no safety and
   * would refuse a legitimate self-hosted explorer.
   *
   * `undefined` on the `local` network specifically, and only there. `local` is a
   * Quickstart standalone network with no canonical block explorer — stellar.expert
   * indexes Testnet and Public, not an operator's own container. Defaulting it to
   * the Testnet explorer would produce a link to the wrong network, and defaulting
   * it to the local Horizon URL would produce a link that is not an explorer at
   * all; both lie silently about what the link opens. Leaving it unset is the
   * honest choice, and it is the least-rippling one: nothing in `apps/api` reads
   * `StellarConfig.explorerUrl` directly today (every use case that builds a
   * transaction link takes its own already-required `explorerBaseUrl: string`),
   * so widening this one field to optional has no other production call site to
   * update.
   */
  readonly explorerUrl: string | undefined;
};

export function parseStellarConfig(env: EnvSource): StellarConfig {
  // A standalone entry point (used directly by adapter tests, not only through
  // `parseApiConfig`), so it reads `APP_ENV` from the same bag rather than
  // requiring a second argument only `api-config.ts` can supply.
  const result = parseStellarConfigResult(env, readPresent(env, "APP_ENV") ?? "");

  if (!result.ok) {
    throw new ConfigurationError("Stellar configuration", result.issues);
  }

  return result.value;
}

/**
 * `environment` is accepted as a plain string, not `DeploymentEnvironment`
 * from `api-config.ts`, for the same reason `cors-config.ts` does it:
 * `api-config.ts` already imports this module to build `ApiConfig.stellar`,
 * and a return edge would make `no-circular` in `.dependency-cruiser.cjs`
 * fail. Any value other than `"local"` gets the closed, Testnet-only
 * boundary — the safe side to fail toward when `APP_ENV` itself is unset or
 * still being validated.
 */
export function parseStellarConfigResult(
  env: EnvSource,
  environment: string
): ParseResult<StellarConfig> {
  const issues: ConfigIssue[] = [];

  const network = resolveNetwork(env, environment, issues);
  const horizonUrl = resolveHorizonUrl(env, network, issues);
  const rpcUrl = resolveRpcUrl(env, network, issues);
  const explorerUrl = resolveExplorerUrl(env, network, issues);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: Object.freeze({
      // Safe: `network` is only `undefined` alongside a pushed issue above,
      // which already returned early.
      network: network as StellarNetwork,
      horizonUrl,
      rpcUrl,
      networkPassphrase:
        network === STELLAR_LOCAL_NETWORK
          ? STELLAR_LOCAL_NETWORK_PASSPHRASE
          : STELLAR_TESTNET_NETWORK_PASSPHRASE,
      explorerUrl
    })
  };
}

/**
 * Resolves and validates `STELLAR_NETWORK` against the D4 boundary: `testnet`
 * in every environment, `local` only under `APP_ENV=local`.
 */
function resolveNetwork(
  env: EnvSource,
  environment: string,
  issues: ConfigIssue[]
): StellarNetwork | undefined {
  const value = readPresent(env, "STELLAR_NETWORK");

  if (value === undefined) {
    issues.push(missingIssue("STELLAR_NETWORK"));
    return undefined;
  }

  if (value === SUPPORTED_STELLAR_NETWORK) {
    return SUPPORTED_STELLAR_NETWORK;
  }

  if (value === STELLAR_LOCAL_NETWORK) {
    if (environment === "local") {
      return STELLAR_LOCAL_NETWORK;
    }

    issues.push(
      unsupportedIssue(
        "STELLAR_NETWORK",
        '"local" is only supported when APP_ENV=local; the public network remains out of scope for this demo'
      )
    );
    return undefined;
  }

  issues.push(
    unsupportedIssue(
      "STELLAR_NETWORK",
      `only "${SUPPORTED_STELLAR_NETWORK}" is supported; the public network is out of scope for this demo`
    )
  );
  return undefined;
}

/**
 * Resolves the Horizon endpoint.
 *
 * `local`: absent means Quickstart's own default; a present value may be any
 * absolute `http(s)` URL — including a non-loopback host, since the API
 * container reaches Quickstart via `http://host.docker.internal:8000`.
 *
 * `testnet` (and the fallback used when `network` itself failed to resolve):
 * unchanged from before U1 — absent means the canonical Testnet host, and a
 * present value must resolve to Testnet or loopback.
 */
function resolveHorizonUrl(
  env: EnvSource,
  network: StellarNetwork | undefined,
  issues: ConfigIssue[]
): string {
  const configured = readPresent(env, "STELLAR_HORIZON_URL");

  if (network === STELLAR_LOCAL_NETWORK) {
    return resolveAbsoluteHttpUrl(configured, "STELLAR_HORIZON_URL", STELLAR_LOCAL_HORIZON_URL, issues);
  }

  if (configured === undefined) {
    return STELLAR_TESTNET_HORIZON_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    issues.push(invalidIssue("STELLAR_HORIZON_URL", "must be an absolute URL"));
    return STELLAR_TESTNET_HORIZON_URL;
  }

  if (isLoopbackHost(parsed.hostname)) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      issues.push(invalidIssue("STELLAR_HORIZON_URL", "must use http or https"));
    }
    return configured;
  }

  if (parsed.hostname !== TESTNET_HORIZON_HOST) {
    issues.push(
      unsupportedIssue(
        "STELLAR_HORIZON_URL",
        `must point at ${TESTNET_HORIZON_HOST} or a loopback host; the public network is out of scope for this demo`
      )
    );
    return configured;
  }

  if (parsed.protocol !== "https:") {
    issues.push(invalidIssue("STELLAR_HORIZON_URL", "must use https"));
  }

  return configured;
}

/**
 * Resolves the Soroban RPC endpoint, mirroring the Horizon boundary above:
 * `local` accepts any absolute `http(s)` URL, `testnet` is closed to the
 * canonical RPC host or loopback.
 */
function resolveRpcUrl(
  env: EnvSource,
  network: StellarNetwork | undefined,
  issues: ConfigIssue[]
): string {
  const configured = readPresent(env, "STELLAR_RPC_URL");

  if (network === STELLAR_LOCAL_NETWORK) {
    return resolveAbsoluteHttpUrl(configured, "STELLAR_RPC_URL", STELLAR_LOCAL_RPC_URL, issues);
  }

  if (configured === undefined) {
    return STELLAR_TESTNET_RPC_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    issues.push(invalidIssue("STELLAR_RPC_URL", "must be an absolute URL"));
    return STELLAR_TESTNET_RPC_URL;
  }

  if (isLoopbackHost(parsed.hostname)) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      issues.push(invalidIssue("STELLAR_RPC_URL", "must use http or https"));
    }
    return configured;
  }

  if (parsed.hostname !== TESTNET_RPC_HOST) {
    issues.push(
      unsupportedIssue(
        "STELLAR_RPC_URL",
        `must point at ${TESTNET_RPC_HOST} or a loopback host; the public network is out of scope for this demo`
      )
    );
    return configured;
  }

  if (parsed.protocol !== "https:") {
    issues.push(invalidIssue("STELLAR_RPC_URL", "must use https"));
  }

  return configured;
}

/**
 * Shared by the two `local`-network URL slices: absent falls back to
 * `fallback`, present must merely be an absolute `http(s)` URL. `local` has
 * no security boundary to enforce on the host — `APP_ENV=local` is the gate,
 * and `#237` explicitly needs a non-loopback host to reach Quickstart from a
 * container.
 */
function resolveAbsoluteHttpUrl(
  configured: string | undefined,
  key: string,
  fallback: string,
  issues: ConfigIssue[]
): string {
  if (configured === undefined) {
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    issues.push(invalidIssue(key, "must be an absolute URL"));
    return fallback;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    issues.push(invalidIssue(key, "must use http or https"));
  }

  return configured;
}

/**
 * Resolves the explorer base. Absent means the canonical Testnet explorer on
 * `testnet`, and `undefined` on `local` (see the `explorerUrl` field doc for
 * why). A present value must be an absolute `http(s)` URL on either network —
 * the link is built by appending a path to it, and a relative base could not
 * produce one.
 *
 * A trailing slash is stripped rather than tolerated: leaving it would produce
 * `…/testnet//tx/<hash>` in every link, which is a doubled separator nobody would
 * notice until they looked.
 */
function resolveExplorerUrl(
  env: EnvSource,
  network: StellarNetwork | undefined,
  issues: ConfigIssue[]
): string | undefined {
  const configured = readPresent(env, "STELLAR_EXPLORER_URL");

  if (network === STELLAR_LOCAL_NETWORK) {
    if (configured === undefined) {
      return undefined;
    }

    let parsed: URL;
    try {
      parsed = new URL(configured);
    } catch {
      issues.push(invalidIssue("STELLAR_EXPLORER_URL", "must be an absolute URL"));
      return undefined;
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      issues.push(invalidIssue("STELLAR_EXPLORER_URL", "must use http or https"));
    }

    return configured.replace(/\/+$/, "");
  }

  if (configured === undefined) {
    return STELLAR_TESTNET_EXPLORER_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    issues.push(invalidIssue("STELLAR_EXPLORER_URL", "must be an absolute URL"));
    return STELLAR_TESTNET_EXPLORER_URL;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    issues.push(invalidIssue("STELLAR_EXPLORER_URL", "must use http or https"));
  }

  return configured.replace(/\/+$/, "");
}

/**
 * Accepts the loopback spellings a local Horizon/RPC double may use.
 *
 * Exported so `stellar-horizon.ts` can apply the same definition when
 * deciding `allowHttp`, instead of re-deciding what counts as loopback.
 */
export function isLoopbackHost(hostname: string): boolean {
  const normalized =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;

  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}
