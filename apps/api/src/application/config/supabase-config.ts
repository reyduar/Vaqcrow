import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import { invalidIssue, missingIssue, readPresent } from "./env-source.js";
import type { EnvSource, ParseResult } from "./env-source.js";
import { Secret } from "./secret.js";

/**
 * Supabase persistence slice.
 *
 * The service-role key and the publishable key both cross this boundary as
 * `Secret`, so the only way to reach a client library is an explicit
 * `reveal()` at the adapter. The publishable key stays optional here because
 * the server process does not serve the browser: it is required by whichever
 * consumer actually exposes it.
 */

export type SupabaseConfig = {
  readonly url: string;
  readonly serviceRoleKey: Secret;
  readonly publishableKey: Secret | undefined;
};

export function parseSupabaseConfig(env: EnvSource): SupabaseConfig {
  const result = parseSupabaseConfigResult(env);

  if (!result.ok) {
    throw new ConfigurationError("Supabase configuration", result.issues);
  }

  return result.value;
}

export function parseSupabaseConfigResult(env: EnvSource): ParseResult<SupabaseConfig> {
  const issues: ConfigIssue[] = [];

  const url = readPresent(env, "SUPABASE_URL");
  if (url === undefined) {
    issues.push(missingIssue("SUPABASE_URL"));
  } else if (!isAbsoluteHttpUrl(url)) {
    issues.push(invalidIssue("SUPABASE_URL", "must be an absolute http(s) URL"));
  }

  const serviceRoleKey = readPresent(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey === undefined) {
    issues.push(missingIssue("SUPABASE_SERVICE_ROLE_KEY"));
  }

  if (issues.length > 0 || url === undefined || serviceRoleKey === undefined) {
    return { ok: false, issues };
  }

  const publishableKey = readPresent(env, "SUPABASE_PUBLISHABLE_KEY");

  return {
    ok: true,
    value: Object.freeze({
      url,
      serviceRoleKey: new Secret(serviceRoleKey),
      publishableKey: publishableKey === undefined ? undefined : new Secret(publishableKey)
    })
  };
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
