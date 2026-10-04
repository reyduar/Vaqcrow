import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import { invalidIssue, readPresent } from "./env-source.js";
import type { EnvSource, ParseResult } from "./env-source.js";
import { Secret } from "./secret.js";

/**
 * Resend transactional-email slice.
 *
 * Optional by the same reasoning as the LLM slice: email delivery backs the
 * in-app notification bell, and a failed or unconfigured email must never stop
 * the API from booting or an action from completing. `RESEND_API_KEY` absent
 * therefore means "email disabled", not "misconfigured" — the honest default
 * for a local run, where Supabase Auth's own mail goes to Mailpit and no Resend
 * credential exists.
 *
 * `EMAIL_FROM` and `APP_BASE_URL` always resolve to a value (a default each),
 * because the email renderer needs both even to describe a disabled slice. The
 * key is wrapped as a `Secret`, so it cannot reach a log line or a serialised
 * response through ordinary formatting.
 *
 * This is the Resend HTTP API, distinct from the SMTP that Supabase Auth uses
 * for account confirmation (`no-reply@vaqcrow.com` is the shared verified
 * sender). Nothing here sends an email; this module only decides whether the
 * process is configured to.
 */

/** The verified Resend sender. Kept as a constant so the default is greppable. */
export const DEFAULT_EMAIL_FROM = "Vaqcrow <no-reply@vaqcrow.com>";

/**
 * The absolute base for email deep links. Matches the local web dev server
 * (`apps/web` on 3001, the same origin `cors-config.ts` allows locally); a
 * hosted run overrides it with its public `APP_BASE_URL`.
 */
export const DEFAULT_APP_BASE_URL = "http://localhost:3001";

/**
 * A display name plus an address, or a bare address. Anchored and newline-free:
 * a value containing CR/LF is rejected explicitly (see `isValidFromAddress`)
 * because it would inject headers into the message.
 */
const EMAIL_FROM_PATTERN =
  /^(?:[^<>\r\n]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)$/;

export type EmailConfig =
  | {
      readonly enabled: false;
      readonly from: string;
      readonly appBaseUrl: string;
    }
  | {
      readonly enabled: true;
      /** Wrapped so it cannot leak through formatting; `reveal()` is the point of use. */
      readonly apiKey: Secret;
      readonly from: string;
      readonly appBaseUrl: string;
    };

/** Standalone entry point, matching `parseSupabaseConfig`'s slice-independence pattern. */
export function parseEmailConfig(env: EnvSource): EmailConfig {
  const result = parseEmailConfigResult(env);

  if (!result.ok) {
    throw new ConfigurationError("Email configuration", result.issues);
  }

  return result.value;
}

export function parseEmailConfigResult(env: EnvSource): ParseResult<EmailConfig> {
  const issues: ConfigIssue[] = [];

  const apiKey = readPresent(env, "RESEND_API_KEY");
  const from = resolveFrom(env, issues);
  const appBaseUrl = resolveAppBaseUrl(env, issues);

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  if (apiKey === undefined) {
    return { ok: true, value: Object.freeze({ enabled: false, from, appBaseUrl }) };
  }

  return {
    ok: true,
    value: Object.freeze({ enabled: true, apiKey: new Secret(apiKey), from, appBaseUrl })
  };
}

/** Convenience for call sites that only need the on/off decision. */
export function emailEnabled(config: EmailConfig): boolean {
  return config.enabled;
}

function resolveFrom(env: EnvSource, issues: ConfigIssue[]): string {
  const configured = readPresent(env, "EMAIL_FROM");

  if (configured === undefined) {
    return DEFAULT_EMAIL_FROM;
  }

  if (!isValidFromAddress(configured)) {
    issues.push(
      invalidIssue(
        "EMAIL_FROM",
        'must be a single-line address such as "Vaqcrow <no-reply@vaqcrow.com>"'
      )
    );
    return DEFAULT_EMAIL_FROM;
  }

  return configured;
}

/**
 * A trailing slash is stripped rather than tolerated: the renderer appends a
 * path (`/portfolio`, `/company`), and a base that kept its slash would produce
 * a doubled separator in every link.
 */
function resolveAppBaseUrl(env: EnvSource, issues: ConfigIssue[]): string {
  const configured = readPresent(env, "APP_BASE_URL");

  if (configured === undefined) {
    return DEFAULT_APP_BASE_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    issues.push(invalidIssue("APP_BASE_URL", "must be an absolute URL"));
    return DEFAULT_APP_BASE_URL;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    issues.push(invalidIssue("APP_BASE_URL", "must use http or https"));
  }

  return configured.replace(/\/+$/, "");
}

/**
 * Rejects a value that carries a header-injecting newline before applying the
 * address shape. The newline check is separate because `$` in a JS regex also
 * matches before a trailing newline, so the pattern alone is not sufficient.
 */
function isValidFromAddress(value: string): boolean {
  if (/[\r\n]/.test(value)) {
    return false;
  }

  return EMAIL_FROM_PATTERN.test(value);
}
