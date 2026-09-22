import { describe, expect, it } from "vitest";
import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import type { EnvSource } from "./env-source.js";
import {
  DEFAULT_LLM_TIMEOUT_MS,
  OPENCODE_GO_BASE_URL,
  parseLlmConfig,
  parseLlmConfigResult
} from "./llm-config.js";
import { REDACTED_MARKER } from "./secret.js";

/**
 * Accept / reject / fallback matrix for the LLM provider contract.
 *
 * No test performs I/O: the provider is never reached, and the credential is a
 * short sentinel so a passing redaction assertion cannot be an accident of
 * length.
 */

const API_KEY_SENTINEL = "llm-key-sentinel-7b2e";

const VALID_ENV: EnvSource = {
  LLM_PROVIDER: "opencode-go",
  LLM_MODEL: "deepseek-v4-pro",
  LLM_API_KEY: API_KEY_SENTINEL
};

const REQUIRED_KEYS = ["LLM_PROVIDER", "LLM_MODEL", "LLM_API_KEY"];

function without(key: string): EnvSource {
  const clone: Record<string, string | undefined> = { ...VALID_ENV };
  delete clone[key];
  return clone;
}

function issuesFrom(env: EnvSource): readonly ConfigIssue[] {
  const result = parseLlmConfigResult(env);

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

describe("required keys", () => {
  it.each(REQUIRED_KEYS)("reports %s as missing when it is absent", (key) => {
    expect(issuesFrom(without(key))).toEqual([
      { key, code: "missing", detail: "required but not set" }
    ]);
  });

  it.each(REQUIRED_KEYS)("treats a blank %s as absent", (key) => {
    expect(issuesFrom({ ...VALID_ENV, [key]: "   " })).toEqual([
      { key, code: "missing", detail: "required but not set" }
    ]);
  });

  it("names the key without echoing the credential while reporting it", () => {
    const result = parseLlmConfigResult(without("LLM_API_KEY"));

    if (result.ok) {
      throw new Error("expected a rejection");
    }

    const message = new ConfigurationError("LLM configuration", result.issues).message;

    expect(message).toContain("LLM_API_KEY");
    expect(message).not.toContain(API_KEY_SENTINEL);
  });

  it("reports every missing key at once rather than one per run", () => {
    const issues = issuesFrom({});

    expect(issues.map((issue) => issue.key)).toEqual(["LLM_PROVIDER", "LLM_MODEL", "LLM_API_KEY"]);
  });
});

describe("the provider is closed", () => {
  it("accepts the supported provider", () => {
    expect(parseLlmConfig(VALID_ENV).provider).toBe("opencode-go");
  });

  it.each(["openai", "anthropic", "opencode", "OPENCODE-GO", "OpenCode-Go", "opencode_go"])(
    "rejects LLM_PROVIDER=%s as unsupported, naming the boundary",
    (value) => {
      const issue = expectSingleIssue({ ...VALID_ENV, LLM_PROVIDER: value }, "LLM_PROVIDER", "unsupported");

      expect(issue.detail).toContain('only "opencode-go" is supported');
    }
  );
});

describe("the model has no default", () => {
  it("requires a model rather than falling back to one", () => {
    expect(issuesFrom(without("LLM_MODEL"))).toEqual([
      { key: "LLM_MODEL", code: "missing", detail: "required but not set" }
    ]);
  });

  it("explains the OpenCode config prefix instead of accepting it", () => {
    const issue = expectSingleIssue(
      { ...VALID_ENV, LLM_MODEL: "opencode-go/deepseek-v4-pro" },
      "LLM_MODEL",
      "invalid"
    );

    expect(issue.detail).toContain("bare model id");
  });

  // A blank model is covered by the required-key matrix above: the contract
  // treats blank as absent, so it reports `missing`, not `invalid`.
  it.each(["DeepSeek-V4-Pro", "deepseek v4", "-deepseek", "a".repeat(65)])(
    "rejects the malformed model id %s",
    (value) => {
      expectSingleIssue({ ...VALID_ENV, LLM_MODEL: value }, "LLM_MODEL", "invalid");
    }
  );

  it.each(["deepseek-v4-pro", "kimi-k3", "glm-5.3", "qwen3.8-max", "mimo-v2.5-pro"])(
    "accepts the documented model id shape: %s",
    (value) => {
      expect(parseLlmConfig({ ...VALID_ENV, LLM_MODEL: value }).model).toBe(value);
    }
  );
});

describe("base URL", () => {
  it("falls back to the provider's canonical base", () => {
    expect(parseLlmConfig(VALID_ENV).baseUrl).toBe(OPENCODE_GO_BASE_URL);
  });

  it("strips a trailing slash rather than building a doubled separator", () => {
    expect(parseLlmConfig({ ...VALID_ENV, LLM_BASE_URL: "https://example.test/v1/" }).baseUrl).toBe(
      "https://example.test/v1"
    );
  });

  it("accepts loopback over http so a local double needs no certificate", () => {
    for (const baseUrl of ["http://localhost:4010/v1", "http://127.0.0.1:4010/v1"]) {
      expect(parseLlmConfig({ ...VALID_ENV, LLM_BASE_URL: baseUrl }).baseUrl).toBe(baseUrl);
    }
  });

  it("refuses plain http on a non-loopback host", () => {
    const issue = expectSingleIssue(
      { ...VALID_ENV, LLM_BASE_URL: "http://example.test/v1" },
      "LLM_BASE_URL",
      "invalid"
    );

    expect(issue.detail).toContain("https");
  });

  it.each(["/v1", "example.test/v1", "not a url"])("refuses a non-absolute base URL: %s", (value) => {
    expectSingleIssue({ ...VALID_ENV, LLM_BASE_URL: value }, "LLM_BASE_URL", "invalid");
  });
});

describe("timeout bounds", () => {
  it("applies the documented default", () => {
    expect(parseLlmConfig(VALID_ENV).timeoutMs).toBe(DEFAULT_LLM_TIMEOUT_MS);
  });

  it("accepts the boundary values and trims whitespace", () => {
    expect(parseLlmConfig({ ...VALID_ENV, LLM_TIMEOUT_MS: "1000" }).timeoutMs).toBe(1_000);
    expect(parseLlmConfig({ ...VALID_ENV, LLM_TIMEOUT_MS: "120000" }).timeoutMs).toBe(120_000);
    expect(parseLlmConfig({ ...VALID_ENV, LLM_TIMEOUT_MS: " 8000 " }).timeoutMs).toBe(8_000);
  });

  it.each(["0", "999", "120001", "-1", "1.5", "10s", "1e3"])(
    "rejects the out-of-range or non-integer timeout %s rather than clamping it",
    (value) => {
      const issue = expectSingleIssue({ ...VALID_ENV, LLM_TIMEOUT_MS: value }, "LLM_TIMEOUT_MS", "invalid");

      expect(issue.detail).toContain("must be an integer between");
    }
  );
});

describe("the credential stays wrapped", () => {
  it("does not reveal the key through ordinary formatting", () => {
    const config = parseLlmConfig(VALID_ENV);

    expect(String(config.apiKey)).toBe(REDACTED_MARKER);
    expect(JSON.stringify(config.apiKey)).toContain(REDACTED_MARKER);
    expect(JSON.stringify(config)).not.toContain(API_KEY_SENTINEL);
  });

  it("reveals the key only through the explicit point of use", () => {
    expect(parseLlmConfig(VALID_ENV).apiKey.reveal()).toBe(API_KEY_SENTINEL);
  });

  it("freezes the result so a later mutation cannot alter validated configuration", () => {
    expect(Object.isFrozen(parseLlmConfig(VALID_ENV))).toBe(true);
  });
});
