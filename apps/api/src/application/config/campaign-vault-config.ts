import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import { invalidIssue, readPresent } from "./env-source.js";
import type { EnvSource, ParseResult } from "./env-source.js";
import { Secret } from "./secret.js";

/**
 * Campaign vault (Soroban factory) configuration slice.
 *
 * Entirely optional, unlike every other slice in this directory: U1 lands the
 * typed shape so U3/U4 have somewhere to read from, but nothing in the demo
 * requires a deployed factory yet. `{ enabled: false }` is the honest default
 * for a process that has not been given contract addresses — the alternative,
 * treating the three keys as required, would break every environment that
 * does not yet run the vault journey (which, as of U1, is all of them).
 *
 * The factory id and the platform secret are required *together*: a factory
 * with no signer, or a signer with nothing to call, are both a
 * misconfiguration rather than a partial-but-valid state, so either alone is
 * rejected instead of silently producing a half-enabled slice.
 */

/** Stellar contract address: `C` followed by 55 base32 characters. */
const CONTRACT_ADDRESS_PATTERN = /^C[A-Z2-7]{55}$/;

/** Stellar secret seed: `S` followed by 55 base32 characters — same shape `redaction.ts` scans for. */
const SECRET_KEY_PATTERN = /^S[A-Z2-7]{55}$/;

export type CampaignVaultConfig =
  | { readonly enabled: false }
  | {
      readonly enabled: true;
      readonly factoryId: string;
      /** The native XLM SAC id, when known. Infrastructure can derive it when absent (no default here). */
      readonly tokenContractId: string | undefined;
      /**
       * Wrapped for the same reason `LlmConfig.apiKey` is: this signs
       * `factory.deploy()` on behalf of the platform (D2), and it must not
       * reach a log line or a serialised response through ordinary formatting.
       */
      readonly platformSecretKey: Secret;
    };

/** Standalone entry point, matching `parseSupabaseConfig`'s slice-independence pattern. */
export function parseCampaignVaultConfig(env: EnvSource): CampaignVaultConfig {
  const result = parseCampaignVaultConfigResult(env);

  if (!result.ok) {
    throw new ConfigurationError("Campaign vault configuration", result.issues);
  }

  return result.value;
}

export function parseCampaignVaultConfigResult(env: EnvSource): ParseResult<CampaignVaultConfig> {
  const issues: ConfigIssue[] = [];

  const factoryId = readPresent(env, "STELLAR_CAMPAIGN_FACTORY_ID");
  const tokenContractId = readPresent(env, "STELLAR_TOKEN_CONTRACT_ID");
  const platformSecretKeyRaw = readPresent(env, "STELLAR_PLATFORM_SECRET_KEY");

  if (factoryId !== undefined && !CONTRACT_ADDRESS_PATTERN.test(factoryId)) {
    issues.push(
      invalidIssue("STELLAR_CAMPAIGN_FACTORY_ID", "must be a Stellar contract address (C… 56 characters)")
    );
  }

  if (tokenContractId !== undefined && !CONTRACT_ADDRESS_PATTERN.test(tokenContractId)) {
    issues.push(
      invalidIssue("STELLAR_TOKEN_CONTRACT_ID", "must be a Stellar contract address (C… 56 characters)")
    );
  }

  if (platformSecretKeyRaw !== undefined && !SECRET_KEY_PATTERN.test(platformSecretKeyRaw)) {
    // The value never appears here or anywhere else in the issue — only the
    // key name and a shape description, matching `ConfigIssue`'s own
    // never-carries-the-value contract.
    issues.push(
      invalidIssue("STELLAR_PLATFORM_SECRET_KEY", "must be a Stellar secret key (S… 56 characters)")
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const hasFactory = factoryId !== undefined;
  const hasSecret = platformSecretKeyRaw !== undefined;

  if (!hasFactory && !hasSecret) {
    return { ok: true, value: Object.freeze({ enabled: false }) };
  }

  if (hasFactory !== hasSecret) {
    const missingKey = hasFactory ? "STELLAR_PLATFORM_SECRET_KEY" : "STELLAR_CAMPAIGN_FACTORY_ID";
    const presentKey = hasFactory ? "STELLAR_CAMPAIGN_FACTORY_ID" : "STELLAR_PLATFORM_SECRET_KEY";

    return {
      ok: false,
      issues: [{ key: missingKey, code: "missing", detail: `required together with ${presentKey}` }]
    };
  }

  return {
    ok: true,
    value: Object.freeze({
      enabled: true,
      factoryId: factoryId as string,
      tokenContractId,
      platformSecretKey: new Secret(platformSecretKeyRaw as string)
    })
  };
}
