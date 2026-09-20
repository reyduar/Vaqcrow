/**
 * Configuration failures, shaped so they are safe to log.
 *
 * An issue names the offending key and what was expected. It never carries the
 * value: a credential that fails validation must not be printed by the very
 * error that reports it. Keeping that invariant in the type — not in the
 * discipline of each call site — is what makes redaction verifiable.
 */

export type ConfigIssueCode = "missing" | "invalid" | "unsupported";

export type ConfigIssue = {
  /** Environment key, e.g. `SUPABASE_SERVICE_ROLE_KEY`. Never the value. */
  readonly key: string;
  readonly code: ConfigIssueCode;
  readonly detail: string;
};

export function formatConfigurationError(scope: string, issues: readonly ConfigIssue[]): string {
  const noun = issues.length === 1 ? "issue" : "issues";
  const lines = issues.map((issue) => `  - ${issue.key}: ${issue.detail} (${issue.code})`);
  return [`Invalid ${scope} (${issues.length} ${noun}):`, ...lines].join("\n");
}

export class ConfigurationError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(scope: string, issues: readonly ConfigIssue[]) {
    super(formatConfigurationError(scope, issues));
    this.name = "ConfigurationError";
    this.issues = issues;
  }
}
