import type { ConfigIssue } from "./config-issue.js";
import { invalidIssue, readPresent } from "./env-source.js";
import type { EnvSource, ParseResult } from "./env-source.js";

/**
 * CORS origin allow-list.
 *
 * `environment` is accepted as a plain string, not `DeploymentEnvironment`
 * from `api-config.ts`, so this module has no import edge back to it —
 * `api-config.ts` already imports this module to build `ApiConfig.cors`, and
 * a return edge would make `no-circular` in `.dependency-cruiser.cjs` fail.
 * Any value other than `"local"` (including a value that later turns out to
 * be an invalid `APP_ENV`) gets the restrictive empty default, which is the
 * safe side to fail toward.
 */

export type CorsConfig = {
  readonly allowedOrigins: readonly string[];
};

/** The web dev server's origins, covering both loopback spellings. */
export const LOCAL_DEFAULT_CORS_ALLOWED_ORIGINS: readonly string[] = Object.freeze([
  "http://localhost:3001",
  "http://127.0.0.1:3001"
]);

const NO_DEFAULT_CORS_ALLOWED_ORIGINS: readonly string[] = Object.freeze([]);

export function parseCorsConfigResult(env: EnvSource, environment: string): ParseResult<CorsConfig> {
  const raw = readPresent(env, "CORS_ALLOWED_ORIGINS");

  if (raw === undefined) {
    const defaults = environment === "local" ? LOCAL_DEFAULT_CORS_ALLOWED_ORIGINS : NO_DEFAULT_CORS_ALLOWED_ORIGINS;
    return { ok: true, value: Object.freeze({ allowedOrigins: defaults }) };
  }

  const issues: ConfigIssue[] = [];
  const allowedOrigins: string[] = [];
  const seen = new Set<string>();

  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

  entries.forEach((entry, index) => {
    const origin = parseExactOrigin(entry);

    if (origin === undefined) {
      issues.push(
        invalidIssue(
          "CORS_ALLOWED_ORIGINS",
          `entry ${index + 1} must be an exact http(s) origin, with no path, query, hash, credentials or wildcard`
        )
      );
      return;
    }

    if (!seen.has(origin)) {
      seen.add(origin);
      allowedOrigins.push(origin);
    }
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: Object.freeze({ allowedOrigins: Object.freeze(allowedOrigins) }) };
}

/**
 * An entry qualifies only when it is already its own origin: parsing it and
 * re-serialising `origin` must round-trip to the same string (after
 * tolerating one trailing slash), which rejects a path, query, hash or
 * embedded credentials by construction rather than by a growing blocklist.
 */
function parseExactOrigin(entry: string): string | undefined {
  const candidate = entry.endsWith("/") ? entry.slice(0, -1) : entry;

  // The URL Standard's host parser does not forbid "*" as a hostname
  // character, so "https://*.example.com" parses and round-trips cleanly —
  // it must still be rejected explicitly, since no real browser Origin
  // header is ever a wildcard.
  if (candidate.includes("*")) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return undefined;
  }

  return parsed.origin === candidate ? parsed.origin : undefined;
}
