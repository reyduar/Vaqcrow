import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import { invalidIssue, missingIssue, readPresent, unsupportedIssue } from "./env-source.js";
import type { EnvSource, ParseResult } from "./env-source.js";

/**
 * Stellar network boundary.
 *
 * The demo settles on Testnet only, so the network is a closed set of one and
 * the public network is rejected by construction rather than by convention.
 * Requiring the value means the process cannot reach a chain without a
 * deliberate, validated Testnet declaration — a security boundary should be
 * opt-out, never opt-in.
 *
 * The passphrase and Horizon URL below are public Testnet constants, not
 * secrets: they are safe in source and in logs.
 */

export const SUPPORTED_STELLAR_NETWORK = "testnet" as const;
export type StellarNetwork = typeof SUPPORTED_STELLAR_NETWORK;

export const STELLAR_TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";
export const STELLAR_TESTNET_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

/**
 * The canonical Testnet explorer, used when `STELLAR_EXPLORER_URL` is absent.
 *
 * `DEMO.md` §7 line 277 lists "URL del explorador" among the minimum variables, so
 * it is configurable — but a demo that forgot to set it should still produce a
 * working link rather than none.
 */
export const STELLAR_TESTNET_EXPLORER_URL = "https://stellar.expert/explorer/testnet";

const TESTNET_HORIZON_HOST = "horizon-testnet.stellar.org";

export type StellarConfig = {
  readonly network: StellarNetwork;
  readonly horizonUrl: string;
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
   */
  readonly explorerUrl: string;
};

export function parseStellarConfig(env: EnvSource): StellarConfig {
  const result = parseStellarConfigResult(env);

  if (!result.ok) {
    throw new ConfigurationError("Stellar configuration", result.issues);
  }

  return result.value;
}

export function parseStellarConfigResult(env: EnvSource): ParseResult<StellarConfig> {
  const issues: ConfigIssue[] = [];

  const network = readPresent(env, "STELLAR_NETWORK");
  if (network === undefined) {
    issues.push(missingIssue("STELLAR_NETWORK"));
  } else if (network !== SUPPORTED_STELLAR_NETWORK) {
    issues.push(
      unsupportedIssue(
        "STELLAR_NETWORK",
        `only "${SUPPORTED_STELLAR_NETWORK}" is supported; the public network is out of scope for this demo`
      )
    );
  }

  const horizonUrl = resolveHorizonUrl(env, issues);
  const explorerUrl = resolveExplorerUrl(env, issues);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: Object.freeze({
      network: SUPPORTED_STELLAR_NETWORK,
      horizonUrl,
      networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
      explorerUrl
    })
  };
}

/**
 * Resolves the explorer base. Absent means the canonical Testnet explorer; a
 * present value must be an absolute `http(s)` URL, because the link is built by
 * appending a path to it and a relative base could not produce one.
 *
 * A trailing slash is stripped rather than tolerated: leaving it would produce
 * `…/testnet//tx/<hash>` in every link, which is a doubled separator nobody would
 * notice until they looked.
 */
function resolveExplorerUrl(env: EnvSource, issues: ConfigIssue[]): string {
  const configured = readPresent(env, "STELLAR_EXPLORER_URL");

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
 * Resolves the Horizon endpoint. Absent means the canonical Testnet host; a
 * present value must resolve to Testnet or loopback, so pointing the demo at
 * the public network fails at startup instead of at settlement time.
 */
function resolveHorizonUrl(env: EnvSource, issues: ConfigIssue[]): string {
  const configured = readPresent(env, "STELLAR_HORIZON_URL");

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

/** Accepts the loopback spellings a local Horizon double may use. */
function isLoopbackHost(hostname: string): boolean {
  const normalized =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;

  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}
