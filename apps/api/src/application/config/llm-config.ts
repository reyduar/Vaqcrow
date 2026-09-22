import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import { invalidIssue, missingIssue, readPresent, unsupportedIssue } from "./env-source.js";
import type { EnvSource, ParseResult } from "./env-source.js";
import { Secret } from "./secret.js";

/**
 * LLM provider boundary.
 *
 * The demo runs against exactly one provider, so the provider is a closed set of
 * one and an unknown value is rejected by construction rather than by
 * convention — the same reasoning as `STELLAR_NETWORK`. The model, by contrast,
 * is deliberately **required with no default**: choosing which model underwrites
 * a loan application is a decision, and a silent fallback would hide it.
 *
 * Nothing here reaches a provider. This module only decides whether the process
 * is configured to talk to one at all.
 *
 * Values verified against the provider's own documentation on 2026-09-22. The
 * live model list is authoritative and is *not* duplicated here: it changes, and
 * a stale list in source is worse than no list. Fetch it with
 * `curl https://opencode.ai/zen/go/v1/models`.
 */

export const SUPPORTED_LLM_PROVIDER = "opencode-go" as const;
export type LlmProvider = typeof SUPPORTED_LLM_PROVIDER;

/**
 * The provider's OpenAI-compatible base. Its `/v1/messages` (Anthropic) dialect
 * is deliberately not modelled: the demo uses one code path, and the models we
 * target are served on `/v1/chat/completions`.
 */
export const OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1";

/**
 * How long the assessment call may take.
 *
 * Set from measurement, not from taste. Three samples per model against the
 * live provider on 2026-09-22 gave `glm-5.3-flash` a median of 7.4 s and a
 * worst case of 11.4 s; 30 s is roughly 2.6x the worst observed sample, which
 * is the headroom a demo can afford without a failure becoming routine. A
 * timeout degrades to human review, never to an answer, so the bound protects
 * the operator rather than the model.
 */
export const DEFAULT_LLM_TIMEOUT_MS = 30_000;
export const MIN_LLM_TIMEOUT_MS = 1_000;
export const MAX_LLM_TIMEOUT_MS = 120_000;

/** Model ids are opaque lowercase slugs, e.g. `deepseek-v4-pro`. */
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/** The prefix OpenCode's own TUI config uses. A trap: the API wants the bare id. */
const OPENCODE_CONFIG_PREFIX = "opencode-go/";

export type LlmConfig = {
  readonly provider: LlmProvider;
  readonly baseUrl: string;
  readonly model: string;
  /**
   * Wrapped, so the credential cannot reach a log line or a serialised
   * response through ordinary formatting. `reveal()` is the only way out and it
   * is greppable in review.
   */
  readonly apiKey: Secret;
  readonly timeoutMs: number;
};

export function parseLlmConfig(env: EnvSource): LlmConfig {
  const result = parseLlmConfigResult(env);

  if (!result.ok) {
    throw new ConfigurationError("LLM configuration", result.issues);
  }

  return result.value;
}

export function parseLlmConfigResult(env: EnvSource): ParseResult<LlmConfig> {
  const issues: ConfigIssue[] = [];

  // Called for its issues. The closed set has exactly one member, so the value
  // below can name it directly without a narrowing cast.
  parseProvider(env, issues);
  const model = parseModel(env, issues);
  const apiKey = readPresent(env, "LLM_API_KEY");
  if (apiKey === undefined) {
    issues.push(missingIssue("LLM_API_KEY"));
  }

  const baseUrl = resolveBaseUrl(env, issues);
  const timeoutMs = parseTimeoutMs(env, issues);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: Object.freeze({
      provider: SUPPORTED_LLM_PROVIDER,
      baseUrl,
      model: model as string,
      apiKey: new Secret(apiKey as string),
      timeoutMs
    })
  };
}

/**
 * The provider is closed. An unrecognised value is reported as `unsupported`
 * rather than `invalid` so the message can name the boundary, which is what a
 * reader needs when they point the demo at a different vendor by accident.
 */
function parseProvider(env: EnvSource, issues: ConfigIssue[]): LlmProvider | undefined {
  const value = readPresent(env, "LLM_PROVIDER");

  if (value === undefined) {
    issues.push(missingIssue("LLM_PROVIDER"));
    return undefined;
  }

  if (value === SUPPORTED_LLM_PROVIDER) {
    return SUPPORTED_LLM_PROVIDER;
  }

  issues.push(
    unsupportedIssue(
      "LLM_PROVIDER",
      `only "${SUPPORTED_LLM_PROVIDER}" is supported; adding a provider is a deliberate change, not a configuration`
    )
  );
  return undefined;
}

/**
 * The model has no default on purpose. The `opencode-go/` prefix gets its own
 * message because it is the single most likely mistake: that form belongs to
 * OpenCode's TUI config, while the API wants the bare id from `/v1/models`.
 */
function parseModel(env: EnvSource, issues: ConfigIssue[]): string | undefined {
  const value = readPresent(env, "LLM_MODEL");

  if (value === undefined) {
    issues.push(missingIssue("LLM_MODEL"));
    return undefined;
  }

  if (value.startsWith(OPENCODE_CONFIG_PREFIX)) {
    issues.push(
      invalidIssue(
        "LLM_MODEL",
        `must be the bare model id, not the "${OPENCODE_CONFIG_PREFIX}" form used by OpenCode's own config`
      )
    );
    return undefined;
  }

  if (!MODEL_ID_PATTERN.test(value)) {
    issues.push(invalidIssue("LLM_MODEL", "must be a lowercase model id such as \"deepseek-v4-pro\""));
    return undefined;
  }

  return value;
}

/**
 * Absent means the provider's canonical base. A present value must be an
 * absolute `https` URL — with loopback `http` allowed so a local double can
 * stand in without a certificate, the same concession `STELLAR_HORIZON_URL`
 * already makes for a local Horizon.
 *
 * A trailing slash is stripped rather than tolerated: the adapter appends a
 * path, and keeping it would produce a doubled separator in every request.
 */
function resolveBaseUrl(env: EnvSource, issues: ConfigIssue[]): string {
  const configured = readPresent(env, "LLM_BASE_URL");

  if (configured === undefined) {
    return OPENCODE_GO_BASE_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    issues.push(invalidIssue("LLM_BASE_URL", "must be an absolute URL"));
    return OPENCODE_GO_BASE_URL;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    issues.push(invalidIssue("LLM_BASE_URL", "must use http or https"));
  } else if (parsed.protocol === "http:" && !isLoopbackHost(parsed.hostname)) {
    issues.push(invalidIssue("LLM_BASE_URL", "must use https unless the host is loopback"));
  }

  return configured.replace(/\/+$/, "");
}

/**
 * Bounds the wait. A value outside the window is rejected rather than clamped:
 * silently turning a 500 ms timeout into 1 s would hide a misconfiguration
 * behind a slower demo, and 0 is almost always someone expecting "no timeout".
 */
function parseTimeoutMs(env: EnvSource, issues: ConfigIssue[]): number {
  const value = readPresent(env, "LLM_TIMEOUT_MS");

  if (value === undefined) {
    return DEFAULT_LLM_TIMEOUT_MS;
  }

  if (!/^\d+$/.test(value)) {
    issues.push(
      invalidIssue(
        "LLM_TIMEOUT_MS",
        `must be an integer between ${MIN_LLM_TIMEOUT_MS} and ${MAX_LLM_TIMEOUT_MS}`
      )
    );
    return DEFAULT_LLM_TIMEOUT_MS;
  }

  const timeoutMs = Number(value);
  if (timeoutMs < MIN_LLM_TIMEOUT_MS || timeoutMs > MAX_LLM_TIMEOUT_MS) {
    issues.push(
      invalidIssue(
        "LLM_TIMEOUT_MS",
        `must be an integer between ${MIN_LLM_TIMEOUT_MS} and ${MAX_LLM_TIMEOUT_MS}`
      )
    );
    return DEFAULT_LLM_TIMEOUT_MS;
  }

  return timeoutMs;
}

/** Accepts the loopback spellings a local provider double may use. */
function isLoopbackHost(hostname: string): boolean {
  const normalized =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;

  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}
