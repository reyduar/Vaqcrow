import type { ConfigIssue } from "./config-issue.js";

/**
 * The environment surface a parser reads from. Parsers never touch
 * `process.env` directly: injecting the record keeps them pure and lets tests
 * exercise a missing or hostile configuration without mutating global state.
 */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ConfigIssue[] };

/** A present, non-blank value, or `undefined`. Blank counts as absent. */
export function readPresent(env: EnvSource, key: string): string | undefined {
  const raw = env[key];

  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function missingIssue(key: string): ConfigIssue {
  return { key, code: "missing", detail: "required but not set" };
}

export function invalidIssue(key: string, detail: string): ConfigIssue {
  return { key, code: "invalid", detail };
}

export function unsupportedIssue(key: string, detail: string): ConfigIssue {
  return { key, code: "unsupported", detail };
}

/**
 * Collects a `missing` issue and continues, so one parse reports every problem
 * at once instead of forcing a fix-run-fix loop across the whole file.
 */
export function requirePresent(
  env: EnvSource,
  key: string,
  issues: ConfigIssue[]
): string | undefined {
  const value = readPresent(env, key);

  if (value === undefined) {
    issues.push(missingIssue(key));
    return undefined;
  }

  return value;
}
