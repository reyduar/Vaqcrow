import { parseCampaignVaultConfigResult } from "./campaign-vault-config.js";
import type { CampaignVaultConfig } from "./campaign-vault-config.js";
import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import { parseCorsConfigResult } from "./cors-config.js";
import type { CorsConfig } from "./cors-config.js";
import { invalidIssue, missingIssue, readPresent, unsupportedIssue } from "./env-source.js";
import type { EnvSource } from "./env-source.js";
import { parseLlmConfigResult } from "./llm-config.js";
import type { LlmConfig } from "./llm-config.js";
import { parseStellarConfigResult } from "./stellar-config.js";
import type { StellarConfig } from "./stellar-config.js";
import { parseSupabaseConfigResult } from "./supabase-config.js";
import type { SupabaseConfig } from "./supabase-config.js";

/**
 * The API process configuration contract.
 *
 * `parseApiConfig` is the only entry point `index.ts` uses, and it either
 * returns a fully validated frozen object or throws a `ConfigurationError`
 * listing every offending key at once. Values are never echoed, so the failure
 * report is safe to log even when a credential is what failed.
 */

export const DEPLOYMENT_ENVIRONMENTS = ["local", "ci", "preview", "demo"] as const;
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const DEFAULT_API_PORT = 3000;
export const DEFAULT_LOG_LEVEL: LogLevel = "info";

export type ApiConfig = {
  readonly environment: DeploymentEnvironment;
  readonly logLevel: LogLevel;
  readonly port: number;
  readonly supabase: SupabaseConfig;
  readonly stellar: StellarConfig;
  readonly llm: LlmConfig;
  readonly cors: CorsConfig;
  readonly campaignVault: CampaignVaultConfig;
};

export function parseApiConfig(env: EnvSource): ApiConfig {
  const issues: ConfigIssue[] = [];

  const environment = parseEnvironment(env, issues);
  const port = parsePort(env, issues);
  const logLevel = parseLogLevel(env, issues);

  const supabase = parseSupabaseConfigResult(env);
  if (!supabase.ok) {
    issues.push(...supabase.issues);
  }

  // Falls back to a non-"local" sentinel when APP_ENV itself failed to parse,
  // which resolves to the restrictive/closed defaults for both slices below —
  // safe, since the whole call throws below anyway once `environment` is
  // undefined. `stellar-config.ts` takes the same plain-string parameter for
  // the same reason `cors-config.ts` does: a `DeploymentEnvironment` return
  // edge back to this module would make `no-circular` fail.
  const stellar = parseStellarConfigResult(env, environment ?? "");
  if (!stellar.ok) {
    issues.push(...stellar.issues);
  }

  const llm = parseLlmConfigResult(env);
  if (!llm.ok) {
    issues.push(...llm.issues);
  }

  const cors = parseCorsConfigResult(env, environment ?? "");
  if (!cors.ok) {
    issues.push(...cors.issues);
  }

  const campaignVault = parseCampaignVaultConfigResult(env);
  if (!campaignVault.ok) {
    issues.push(...campaignVault.issues);
  }

  if (
    !supabase.ok ||
    !stellar.ok ||
    !llm.ok ||
    !cors.ok ||
    !campaignVault.ok ||
    environment === undefined ||
    port === undefined ||
    logLevel === undefined
  ) {
    throw new ConfigurationError("API configuration", issues);
  }

  return Object.freeze({
    environment,
    port,
    logLevel,
    supabase: supabase.value,
    stellar: stellar.value,
    llm: llm.value,
    cors: cors.value,
    campaignVault: campaignVault.value
  });
}

/**
 * The deployment environment is explicit and closed: `production` is named in
 * the message so an accidental production run fails loudly instead of
 * silently settling on Testnet.
 */
function parseEnvironment(env: EnvSource, issues: ConfigIssue[]): DeploymentEnvironment | undefined {
  const value = readPresent(env, "APP_ENV");

  if (value === undefined) {
    issues.push(missingIssue("APP_ENV"));
    return undefined;
  }

  if (isDeploymentEnvironment(value)) {
    return value;
  }

  if (value === "production") {
    issues.push(
      unsupportedIssue(
        "APP_ENV",
        '"production" is out of scope for this demo; Testnet and synthetic data only'
      )
    );
    return undefined;
  }

  issues.push(invalidIssue("APP_ENV", `must be one of: ${DEPLOYMENT_ENVIRONMENTS.join(", ")}`));
  return undefined;
}

function isDeploymentEnvironment(value: string): value is DeploymentEnvironment {
  return (DEPLOYMENT_ENVIRONMENTS as readonly string[]).includes(value);
}

function parsePort(env: EnvSource, issues: ConfigIssue[]): number | undefined {
  const value = readPresent(env, "PORT");

  if (value === undefined) {
    return DEFAULT_API_PORT;
  }

  if (!/^\d+$/.test(value)) {
    issues.push(invalidIssue("PORT", "must be an integer between 1 and 65535"));
    return undefined;
  }

  const port = Number(value);
  if (port < 1 || port > 65535) {
    issues.push(invalidIssue("PORT", "must be an integer between 1 and 65535"));
    return undefined;
  }

  return port;
}

function parseLogLevel(env: EnvSource, issues: ConfigIssue[]): LogLevel | undefined {
  const value = readPresent(env, "LOG_LEVEL");

  if (value === undefined) {
    return DEFAULT_LOG_LEVEL;
  }

  if (!(LOG_LEVELS as readonly string[]).includes(value)) {
    issues.push(invalidIssue("LOG_LEVEL", `must be one of: ${LOG_LEVELS.join(", ")}`));
    return undefined;
  }

  return value as LogLevel;
}
