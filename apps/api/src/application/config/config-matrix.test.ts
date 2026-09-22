import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_PORT,
  DEFAULT_LOG_LEVEL,
  DEPLOYMENT_ENVIRONMENTS,
  LOG_LEVELS,
  parseApiConfig
} from "./api-config.js";
import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import type { EnvSource } from "./env-source.js";
import { redactForLog } from "./redaction.js";
import { REDACTED_MARKER } from "./secret.js";
import { STELLAR_TESTNET_HORIZON_URL, STELLAR_TESTNET_NETWORK_PASSPHRASE } from "./stellar-config.js";

/**
 * Exhaustive accept / reject / fallback matrix for the configuration contract,
 * plus the integration that matters most in practice: a whole parsed
 * configuration is safe to serialise and safe to log.
 *
 * Every fixture is a literal and no test performs I/O, so the suite is
 * reproducible with no Testnet, Horizon, Supabase or LLM provider reachable.
 *
 * The credential sentinels are deliberately short: the key-name net in
 * `redaction.ts` is what must catch them, not the 40-character opaque-token
 * pattern, so a passing assertion cannot be an accident of length.
 */

const SERVICE_ROLE_SENTINEL = "svc-role-sentinel-9f3a";
const PUBLISHABLE_SENTINEL = "pub-sentinel-4c1d";
const LLM_API_KEY_SENTINEL = "llm-key-sentinel-5a7c";

const REQUIRED_KEYS = [
  "APP_ENV",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STELLAR_NETWORK",
  "LLM_PROVIDER",
  "LLM_MODEL",
  "LLM_API_KEY"
];

const VALID_ENV: EnvSource = {
  APP_ENV: "local",
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_SENTINEL,
  SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_SENTINEL,
  STELLAR_NETWORK: "testnet",
  LLM_PROVIDER: "opencode-go",
  LLM_MODEL: "deepseek-v4-pro",
  LLM_API_KEY: LLM_API_KEY_SENTINEL
};

function without(key: string): EnvSource {
  const clone: Record<string, string | undefined> = { ...VALID_ENV };
  delete clone[key];
  return clone;
}

function catchConfigError(env: EnvSource): ConfigurationError {
  try {
    parseApiConfig(env);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return error;
    }
    throw error;
  }

  throw new Error("expected parseApiConfig to reject this environment");
}

function issuesFrom(env: EnvSource): readonly ConfigIssue[] {
  return catchConfigError(env).issues;
}

/** Asserts exactly one issue, on `key`, with the expected code. */
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

  it.each(REQUIRED_KEYS)("names %s without echoing a credential while reporting it", (key) => {
    const message = catchConfigError(without(key)).message;

    expect(message).toContain(key);
    expect(message).not.toContain(SERVICE_ROLE_SENTINEL);
    expect(message).not.toContain(PUBLISHABLE_SENTINEL);
    expect(message).not.toContain(LLM_API_KEY_SENTINEL);
  });

  it("does not let an optional value satisfy a required key", () => {
    expect(
      issuesFrom({ PORT: "8080", LOG_LEVEL: "debug", ...without("SUPABASE_SERVICE_ROLE_KEY") })
    ).toEqual([{ key: "SUPABASE_SERVICE_ROLE_KEY", code: "missing", detail: "required but not set" }]);
  });
});

describe("closed enumerations", () => {
  it("accepts every documented deployment environment", () => {
    for (const environment of DEPLOYMENT_ENVIRONMENTS) {
      expect(parseApiConfig({ ...VALID_ENV, APP_ENV: environment }).environment).toBe(environment);
    }
  });

  it.each(["staging", "prod", "dev", "test", "Local", "LOCAL", "QA"])(
    "rejects APP_ENV=%s as an invalid value, not as a scope problem",
    (value) => {
      const issue = expectSingleIssue({ ...VALID_ENV, APP_ENV: value }, "APP_ENV", "invalid");

      expect(issue.detail).toContain("must be one of");
    }
  );

  it("rejects production as unsupported and names the scope limit", () => {
    const issue = expectSingleIssue({ ...VALID_ENV, APP_ENV: "production" }, "APP_ENV", "unsupported");

    expect(issue.detail).toContain("out of scope");
  });

  it("accepts every documented log level", () => {
    for (const level of LOG_LEVELS) {
      expect(parseApiConfig({ ...VALID_ENV, LOG_LEVEL: level }).logLevel).toBe(level);
    }
  });

  it.each(["verbose", "INFO", "warn2", "off", "none", "10"])("rejects LOG_LEVEL=%s", (value) => {
    const issue = expectSingleIssue({ ...VALID_ENV, LOG_LEVEL: value }, "LOG_LEVEL", "invalid");

    expect(issue.detail).toContain("must be one of");
  });

  it.each(["public", "pubnet", "mainnet", "main", "futurenet", "TESTNET", "Testnet", "test-net", "local"])(
    "closes STELLAR_NETWORK against %s",
    (value) => {
      const issue = expectSingleIssue(
        { ...VALID_ENV, STELLAR_NETWORK: value },
        "STELLAR_NETWORK",
        "unsupported"
      );

      expect(issue.detail).toContain('only "testnet" is supported');
    }
  );
});

describe("defaults and fallbacks", () => {
  it("applies the documented defaults and reports no issue", () => {
    const config = parseApiConfig(VALID_ENV);

    expect(config.port).toBe(DEFAULT_API_PORT);
    expect(config.logLevel).toBe(DEFAULT_LOG_LEVEL);
    expect(config.stellar.horizonUrl).toBe(STELLAR_TESTNET_HORIZON_URL);
  });

  it("accepts in-range ports, including one padded with whitespace", () => {
    for (const [raw, expected] of [
      ["8080", 8080],
      ["1", 1],
      ["65535", 65535],
      [" 8080 ", 8080]
    ] as ReadonlyArray<readonly [string, number]>) {
      expect(parseApiConfig({ ...VALID_ENV, PORT: raw }).port).toBe(expected);
    }
  });

  it.each(["0", "65536", "8080a", "-1", "80.5", "1e3", "0x10"])("rejects PORT=%s as invalid", (value) => {
    const issue = expectSingleIssue({ ...VALID_ENV, PORT: value }, "PORT", "invalid");

    expect(issue.detail).toContain("must be an integer");
  });

  it("treats a blank PORT as unset and falls back to the default", () => {
    expect(parseApiConfig({ ...VALID_ENV, PORT: "   " }).port).toBe(DEFAULT_API_PORT);
  });

  it("trims surrounding whitespace rather than rejecting it", () => {
    const config = parseApiConfig({ ...VALID_ENV, APP_ENV: "  local  ", STELLAR_NETWORK: "  testnet  " });

    expect(config.environment).toBe("local");
    expect(config.stellar.network).toBe("testnet");
  });

  it("falls back to the canonical Testnet host when no Horizon URL is configured", () => {
    expect(parseApiConfig(without("STELLAR_HORIZON_URL")).stellar.horizonUrl).toBe(
      STELLAR_TESTNET_HORIZON_URL
    );
  });

  it("accepts Testnet and loopback Horizon endpoints", () => {
    for (const horizonUrl of [
      "https://horizon-testnet.stellar.org",
      "http://localhost:8000",
      "http://127.0.0.1:8001",
      "https://localhost:8443"
    ]) {
      expect(parseApiConfig({ ...VALID_ENV, STELLAR_HORIZON_URL: horizonUrl }).stellar.horizonUrl).toBe(
        horizonUrl
      );
    }
  });

  it.each([
    "https://horizon.stellar.org",
    "https://horizon-futurenet.stellar.org",
    "https://horizon-testnet.stellar.org.evil.example",
    "https://evil.example.com/horizon-testnet.stellar.org",
    "https://127.0.0.1.evil.example"
  ])("refuses a Horizon endpoint that is not Testnet or loopback: %s", (horizonUrl) => {
    expectSingleIssue({ ...VALID_ENV, STELLAR_HORIZON_URL: horizonUrl }, "STELLAR_HORIZON_URL", "unsupported");
  });

  it.each(["http://horizon-testnet.stellar.org", "ftp://horizon-testnet.stellar.org"])(
    "refuses a non-https transport on the canonical Testnet host: %s",
    (horizonUrl) => {
      expectSingleIssue({ ...VALID_ENV, STELLAR_HORIZON_URL: horizonUrl }, "STELLAR_HORIZON_URL", "invalid");
    }
  );

  it.each(["/horizon", "horizon-testnet.stellar.org", "not a url"])(
    "refuses a non-absolute Horizon URL: %s",
    (horizonUrl) => {
      expectSingleIssue({ ...VALID_ENV, STELLAR_HORIZON_URL: horizonUrl }, "STELLAR_HORIZON_URL", "invalid");
    }
  );

  it.each(["fixture.supabase.co", "/v1", "ftp://fixture.supabase.co"])(
    "refuses a non-http(s) Supabase URL: %s",
    (supabaseUrl) => {
      expectSingleIssue({ ...VALID_ENV, SUPABASE_URL: supabaseUrl }, "SUPABASE_URL", "invalid");
    }
  );
});

describe("determinism and purity", () => {
  it("reads only the injected environment and does not mutate it", () => {
    const input: Record<string, string | undefined> = { ...VALID_ENV };
    const snapshot: Record<string, string | undefined> = { ...input };

    const first = parseApiConfig(input);
    const second = parseApiConfig(input);

    expect(input).toEqual(snapshot);
    expect(second.environment).toBe(first.environment);
    expect(second.port).toBe(first.port);
    expect(second.logLevel).toBe(first.logLevel);
    expect(second.stellar).toEqual(first.stellar);
    expect(second.supabase.url).toBe(first.supabase.url);
    expect(second.supabase.serviceRoleKey.reveal()).toBe(first.supabase.serviceRoleKey.reveal());
  });

  it("is order-independent: the same values in a different insertion order parse identically", () => {
    const config = parseApiConfig({
      STELLAR_NETWORK: "testnet",
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_SENTINEL,
      SUPABASE_URL: VALID_ENV["SUPABASE_URL"],
      APP_ENV: "local",
      LLM_API_KEY: LLM_API_KEY_SENTINEL,
      LLM_MODEL: "deepseek-v4-pro",
      LLM_PROVIDER: "opencode-go"
    });

    expect(config.environment).toBe("local");
    expect(config.supabase.serviceRoleKey.reveal()).toBe(SERVICE_ROLE_SENTINEL);
  });

  it("freezes the result so a later mutation cannot alter validated configuration", () => {
    const config = parseApiConfig(VALID_ENV);

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.supabase)).toBe(true);
    expect(Object.isFrozen(config.stellar)).toBe(true);
  });

  it("accepts an environment assembled entirely from synthetic literals", () => {
    // The declared host is a fixture domain and every credential is a sentinel,
    // which is what makes this suite runnable with no live service reachable.
    const config = parseApiConfig(VALID_ENV);

    expect(config.supabase.url).toBe("https://fixture.supabase.co");
    expect(config.stellar.horizonUrl).toBe(STELLAR_TESTNET_HORIZON_URL);
  });
});

describe("a parsed configuration is safe to serialise and to log", () => {
  it("survives JSON serialisation without revealing a credential", () => {
    const serialised = JSON.stringify(parseApiConfig(VALID_ENV));

    expect(serialised).not.toContain(SERVICE_ROLE_SENTINEL);
    expect(serialised).not.toContain(PUBLISHABLE_SENTINEL);
    expect(serialised).not.toContain(LLM_API_KEY_SENTINEL);
    expect(serialised).toContain(REDACTED_MARKER);
  });

  it("survives the log redactor while keeping its operational context readable", () => {
    const serialised = JSON.stringify(redactForLog(parseApiConfig(VALID_ENV)));

    expect(serialised).not.toContain(SERVICE_ROLE_SENTINEL);
    expect(serialised).not.toContain(PUBLISHABLE_SENTINEL);
    expect(serialised).not.toContain(LLM_API_KEY_SENTINEL);
    // Traceability is the point of the demo: non-secret context must survive.
    expect(serialised).toContain("local");
    expect(serialised).toContain("testnet");
    expect(serialised).toContain("fixture.supabase.co");
    // Which model underwrites an application is traceability, not a secret.
    expect(serialised).toContain("deepseek-v4-pro");
  });

  it("keeps the network identity readable while masking the passphrase itself", () => {
    // Verified tradeoff, not an oversight. The Testnet passphrase is a public
    // constant, but `isSensitiveKey` cannot tell a public network passphrase
    // from a secret one, so it errs toward masking — the same choice that keeps
    // a real passphrase out of a log. What Feature #14 actually needs is the
    // network identity, and that survives in `network` and `horizonUrl`.
    const redacted = redactForLog(parseApiConfig(VALID_ENV)) as {
      stellar?: { network?: string; horizonUrl?: string; networkPassphrase?: string };
    };

    expect(redacted.stellar?.network).toBe("testnet");
    expect(redacted.stellar?.horizonUrl).toBe(STELLAR_TESTNET_HORIZON_URL);
    expect(redacted.stellar?.networkPassphrase).toBe(REDACTED_MARKER);
    expect(redacted.stellar?.networkPassphrase).not.toBe(STELLAR_TESTNET_NETWORK_PASSPHRASE);
  });

  it("masks a raw credential placed under a secret-shaped key, even unwrapped", () => {
    const serialised = JSON.stringify(
      redactForLog({ SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_SENTINEL })
    );

    expect(serialised).not.toContain(SERVICE_ROLE_SENTINEL);
    expect(serialised).toContain(REDACTED_MARKER);
  });
});
