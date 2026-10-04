import { describe, expect, it } from "vitest";
import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import {
  DEFAULT_APP_BASE_URL,
  DEFAULT_EMAIL_FROM,
  emailEnabled,
  parseEmailConfig,
  parseEmailConfigResult
} from "./email-config.js";
import type { EnvSource } from "./env-source.js";
import { REDACTED_MARKER } from "./secret.js";

/**
 * Accept / reject / fallback matrix for the Resend email slice.
 *
 * The key is optional by design — the same reasoning as the LLM slice, where
 * the provider is advisory and never gates boot — so every test here is about
 * a slice that is *allowed* to be disabled. No test performs I/O: Resend is
 * never reached, and the credential is a short sentinel so a passing
 * redaction assertion cannot be an accident of length.
 */

const API_KEY_SENTINEL = "resend-key-sentinel-4d1a";

const VALID_ENV: EnvSource = { RESEND_API_KEY: API_KEY_SENTINEL };

function issuesFrom(env: EnvSource): readonly ConfigIssue[] {
  const result = parseEmailConfigResult(env);

  if (result.ok) {
    throw new Error("expected the parser to reject this environment");
  }

  return result.issues;
}

function expectSingleIssue(env: EnvSource, key: string, code: ConfigIssue["code"]): ConfigIssue {
  const issues = issuesFrom(env);

  expect(issues).toHaveLength(1);
  const issue = issues[0];
  expect(issue).toMatchObject({ key, code });

  if (!issue) {
    throw new Error("expected one issue");
  }

  return issue;
}

describe("optional slice", () => {
  it("is disabled when RESEND_API_KEY is absent and adds no required key", () => {
    const config = parseEmailConfig({});

    expect(config).toEqual({
      enabled: false,
      from: DEFAULT_EMAIL_FROM,
      appBaseUrl: DEFAULT_APP_BASE_URL
    });
    expect(emailEnabled(config)).toBe(false);
    expect(parseEmailConfigResult({})).toEqual({
      ok: true,
      value: { enabled: false, from: DEFAULT_EMAIL_FROM, appBaseUrl: DEFAULT_APP_BASE_URL }
    });
  });

  it.each(["", "   "])("treats a blank RESEND_API_KEY (%j) as absent", (blank) => {
    expect(parseEmailConfig({ RESEND_API_KEY: blank }).enabled).toBe(false);
  });

  it("enables the slice and wraps the credential when the key is present", () => {
    const config = parseEmailConfig(VALID_ENV);

    expect(config.enabled).toBe(true);
    expect(emailEnabled(config)).toBe(true);
    if (config.enabled) {
      expect(config.apiKey.reveal()).toBe(API_KEY_SENTINEL);
    }
  });
});

describe("EMAIL_FROM", () => {
  it("defaults to the verified sender", () => {
    expect(DEFAULT_EMAIL_FROM).toBe("Vaqcrow <no-reply@vaqcrow.com>");
    expect(parseEmailConfig(VALID_ENV).from).toBe(DEFAULT_EMAIL_FROM);
    expect(parseEmailConfig({}).from).toBe(DEFAULT_EMAIL_FROM);
  });

  it("accepts a display name and a bare address", () => {
    expect(parseEmailConfig({ ...VALID_ENV, EMAIL_FROM: "Vaqcrow <hola@vaqcrow.com>" }).from).toBe(
      "Vaqcrow <hola@vaqcrow.com>"
    );
    expect(parseEmailConfig({ ...VALID_ENV, EMAIL_FROM: "hola@vaqcrow.com" }).from).toBe(
      "hola@vaqcrow.com"
    );
  });

  it.each(["not an address", "Vaqcrow <>", "vaqcrow.com", "Name <broken@>"])(
    "rejects the malformed sender %j",
    (value) => {
      expectSingleIssue({ ...VALID_ENV, EMAIL_FROM: value }, "EMAIL_FROM", "invalid");
    }
  );

  it("refuses a header-injecting newline in the sender", () => {
    const issue = expectSingleIssue(
      { ...VALID_ENV, EMAIL_FROM: "Vaqcrow\nBcc: attacker@example.test <no-reply@vaqcrow.com>" },
      "EMAIL_FROM",
      "invalid"
    );

    expect(issue.detail).toContain("single-line");
  });
});

describe("APP_BASE_URL", () => {
  it("defaults to the local web dev server", () => {
    expect(DEFAULT_APP_BASE_URL).toBe("http://localhost:3001");
    expect(parseEmailConfig(VALID_ENV).appBaseUrl).toBe(DEFAULT_APP_BASE_URL);
    expect(parseEmailConfig({}).appBaseUrl).toBe(DEFAULT_APP_BASE_URL);
  });

  it("strips a trailing slash rather than building a doubled separator", () => {
    expect(parseEmailConfig({ ...VALID_ENV, APP_BASE_URL: "https://app.example.test/" }).appBaseUrl).toBe(
      "https://app.example.test"
    );
  });

  it.each(["/portfolio", "app.example.test", "not a url", "ftp://app.example.test"])(
    "rejects the non-absolute or non-http base %j",
    (value) => {
      expectSingleIssue({ ...VALID_ENV, APP_BASE_URL: value }, "APP_BASE_URL", "invalid");
    }
  );
});

describe("the credential stays wrapped", () => {
  it("does not reveal the key through ordinary formatting", () => {
    const config = parseEmailConfig(VALID_ENV);

    expect(config.enabled).toBe(true);
    if (config.enabled) {
      expect(String(config.apiKey)).toBe(REDACTED_MARKER);
      expect(JSON.stringify(config.apiKey)).toContain(REDACTED_MARKER);
    }
    expect(JSON.stringify(config)).not.toContain(API_KEY_SENTINEL);
  });

  it("freezes the result so a later mutation cannot alter validated configuration", () => {
    expect(Object.isFrozen(parseEmailConfig(VALID_ENV))).toBe(true);
    expect(Object.isFrozen(parseEmailConfig({}))).toBe(true);
  });

  it("never echoes the key while reporting another invalid value", () => {
    const result = parseEmailConfigResult({ ...VALID_ENV, APP_BASE_URL: "not a url" });

    if (result.ok) {
      throw new Error("expected a rejection");
    }

    const message = new ConfigurationError("Email configuration", result.issues).message;

    expect(message).toContain("APP_BASE_URL");
    expect(message).not.toContain(API_KEY_SENTINEL);
  });
});
