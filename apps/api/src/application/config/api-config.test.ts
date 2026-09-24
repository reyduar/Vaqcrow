import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOG_LEVEL,
  parseApiConfig,
  type ApiConfig,
  type LogLevel
} from "./api-config.js";
import { ConfigurationError } from "./config-issue.js";
import type { ConfigIssue } from "./config-issue.js";
import { parseCampaignVaultConfig } from "./campaign-vault-config.js";
import { LOCAL_DEFAULT_CORS_ALLOWED_ORIGINS } from "./cors-config.js";
import type { EnvSource } from "./env-source.js";
import {
  parseStellarConfig,
  STELLAR_LOCAL_NETWORK_PASSPHRASE,
  STELLAR_TESTNET_EXPLORER_URL,
  STELLAR_TESTNET_NETWORK_PASSPHRASE
} from "./stellar-config.js";
import { parseSupabaseConfig } from "./supabase-config.js";

/** A complete, valid environment. Values are synthetic fixtures, not credentials. */
const VALID_ENV: EnvSource = {
  APP_ENV: "local",
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-fixture",
  SUPABASE_PUBLISHABLE_KEY: "publishable-fixture",
  STELLAR_NETWORK: "testnet",
  LLM_PROVIDER: "opencode-go",
  LLM_MODEL: "deepseek-v4-pro",
  LLM_API_KEY: "llm-key-fixture"
};

function captureIssues(env: EnvSource): readonly ConfigIssue[] {
  try {
    parseApiConfig(env);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return error.issues;
    }
    throw error;
  }

  throw new Error("expected parseApiConfig to reject this environment");
}

function issueFor(env: EnvSource, key: string): ConfigIssue | undefined {
  return captureIssues(env).find((issue) => issue.key === key);
}

describe("parseApiConfig — accepted configuration", () => {
  it("returns a frozen, fully typed configuration", () => {
    const config: ApiConfig = parseApiConfig(VALID_ENV);

    expect(Object.isFrozen(config)).toBe(true);
    expect(config.environment).toBe("local");
    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe(DEFAULT_LOG_LEVEL);
    expect(config.supabase.url).toBe("https://fixture.supabase.co");
    expect(config.supabase.serviceRoleKey.reveal()).toBe("service-role-fixture");
    expect(config.stellar.network).toBe("testnet");
    expect(config.stellar.horizonUrl).toBe("https://horizon-testnet.stellar.org");
    expect(config.stellar.networkPassphrase).toBe(STELLAR_TESTNET_NETWORK_PASSPHRASE);
  });

  it("defaults the explorer URL to the canonical Testnet explorer", () => {
    // The constant is pinned by its own literal, not only compared against the
    // parsed value: two `undefined`s would satisfy that comparison while proving
    // nothing at all.
    expect(STELLAR_TESTNET_EXPLORER_URL).toBe("https://stellar.expert/explorer/testnet");
    expect(parseApiConfig(VALID_ENV).stellar.explorerUrl).toBe(STELLAR_TESTNET_EXPLORER_URL);
  });

  it("accepts an explicit port and log level", () => {
    const config = parseApiConfig({ ...VALID_ENV, PORT: "8080", LOG_LEVEL: "debug" });

    expect(config.port).toBe(8080);
    expect(config.logLevel).toBe<LogLevel>("debug");
  });

  it("accepts a loopback Horizon double over http", () => {
    const config = parseApiConfig({ ...VALID_ENV, STELLAR_HORIZON_URL: "http://127.0.0.1:8001" });

    expect(config.stellar.horizonUrl).toBe("http://127.0.0.1:8001");
  });

  it("accepts an explicit explorer URL and strips its trailing slashes", () => {
    const config = parseApiConfig({
      ...VALID_ENV,
      STELLAR_EXPLORER_URL: "https://stellar.expert/explorer/testnet/"
    });

    // Normalised here rather than at every use: the link is built by appending a
    // path, so a base that kept its slash would produce a doubled one.
    expect(config.stellar.explorerUrl).toBe("https://stellar.expert/explorer/testnet");
  });

  it("accepts an explorer that is not the canonical Testnet one", () => {
    // Deliberately unlike the Horizon URL. A Horizon endpoint decides where money
    // is submitted, so it is closed to Testnet; the explorer is a display link, so
    // pointing it elsewhere cannot move anything.
    const config = parseApiConfig({
      ...VALID_ENV,
      STELLAR_EXPLORER_URL: "https://example.invalid/explorer"
    });

    expect(config.stellar.explorerUrl).toBe("https://example.invalid/explorer");
  });

  it.each(["local", "ci", "preview", "demo"])("accepts the %s environment", (environment) => {
    expect(parseApiConfig({ ...VALID_ENV, APP_ENV: environment }).environment).toBe(environment);
  });

  it("wires the CORS slice, defaulting to the local web origins on APP_ENV=local", () => {
    expect(parseApiConfig(VALID_ENV).cors.allowedOrigins).toEqual(LOCAL_DEFAULT_CORS_ALLOWED_ORIGINS);
  });

  it("wires an explicit CORS_ALLOWED_ORIGINS through to the parsed configuration", () => {
    const config = parseApiConfig({
      ...VALID_ENV,
      APP_ENV: "demo",
      CORS_ALLOWED_ORIGINS: "https://vaqcrow-web.example.com"
    });

    expect(config.cors.allowedOrigins).toEqual(["https://vaqcrow-web.example.com"]);
  });
});

describe("parseApiConfig — missing configuration fails clearly", () => {
  it("reports every missing key in a single failure", () => {
    const error = (() => {
      try {
        parseApiConfig({});
      } catch (caught) {
        return caught;
      }
      throw new Error("expected parseApiConfig to reject an empty environment");
    })();

    expect(error).toBeInstanceOf(ConfigurationError);

    const issues = (error as ConfigurationError).issues;
    expect(issues.map((issue) => issue.key).sort()).toEqual(
      [
        "APP_ENV",
        "STELLAR_NETWORK",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_URL",
        "LLM_API_KEY",
        "LLM_MODEL",
        "LLM_PROVIDER"
      ].sort()
    );
    expect(issues.every((issue) => issue.code === "missing")).toBe(true);
    expect((error as ConfigurationError).message).toContain("Invalid API configuration (7 issues)");
  });

  it("treats a blank value as absent", () => {
    const issues = captureIssues({ ...VALID_ENV, SUPABASE_SERVICE_ROLE_KEY: "   " });

    expect(issues).toEqual([{ key: "SUPABASE_SERVICE_ROLE_KEY", code: "missing", detail: "required but not set" }]);
  });
});

describe("parseApiConfig — the failure report never echoes a value", () => {
  it("names the keys without reproducing the rejected values", () => {
    const sentinel = "sentinel-value-that-must-not-be-echoed";

    const message = (() => {
      try {
        parseApiConfig({
          ...VALID_ENV,
          SUPABASE_URL: sentinel,
          STELLAR_NETWORK: sentinel,
          PORT: sentinel
        });
      } catch (error) {
        return (error as ConfigurationError).message;
      }
      throw new Error("expected parseApiConfig to reject this environment");
    })();

    expect(message).not.toContain(sentinel);
    expect(message).toContain("SUPABASE_URL");
    expect(message).toContain("STELLAR_NETWORK");
    expect(message).toContain("PORT");
  });
});

describe("parseApiConfig — out-of-scope environments are rejected", () => {
  it("rejects production explicitly", () => {
    const issue = issueFor({ ...VALID_ENV, APP_ENV: "production" }, "APP_ENV");

    expect(issue?.code).toBe("unsupported");
    expect(issue?.detail).toContain("out of scope");
  });

  it("rejects an unknown environment", () => {
    expect(issueFor({ ...VALID_ENV, APP_ENV: "staging" }, "APP_ENV")?.code).toBe("invalid");
  });

  it("rejects a malformed or out-of-range port", () => {
    expect(issueFor({ ...VALID_ENV, PORT: "8080a" }, "PORT")?.code).toBe("invalid");
    expect(issueFor({ ...VALID_ENV, PORT: "70000" }, "PORT")?.code).toBe("invalid");
    expect(issueFor({ ...VALID_ENV, PORT: "0" }, "PORT")?.code).toBe("invalid");
  });

  it("rejects an unknown log level", () => {
    expect(issueFor({ ...VALID_ENV, LOG_LEVEL: "verbose" }, "LOG_LEVEL")?.code).toBe("invalid");
  });

  it("rejects a non-absolute Supabase URL", () => {
    expect(issueFor({ ...VALID_ENV, SUPABASE_URL: "fixture.supabase.co" }, "SUPABASE_URL")?.code).toBe(
      "invalid"
    );
  });

  it("rejects a wildcard CORS_ALLOWED_ORIGINS entry", () => {
    expect(issueFor({ ...VALID_ENV, CORS_ALLOWED_ORIGINS: "*" }, "CORS_ALLOWED_ORIGINS")?.code).toBe(
      "invalid"
    );
  });
});

describe("parseStellarConfig — the Testnet boundary", () => {
  it("rejects any network other than testnet", () => {
    for (const network of ["public", "mainnet", "futurenet", "TESTNET"]) {
      const issue = (() => {
        try {
          parseStellarConfig({ ...VALID_ENV, STELLAR_NETWORK: network });
        } catch (error) {
          return (error as ConfigurationError).issues[0];
        }
        throw new Error(`expected ${network} to be rejected`);
      })();

      expect(issue?.key).toBe("STELLAR_NETWORK");
      expect(issue?.code).toBe("unsupported");
    }
  });

  it("rejects a Horizon endpoint outside Testnet and loopback", () => {
    for (const horizonUrl of [
      "https://horizon.stellar.org",
      "https://horizon-futurenet.stellar.org",
      "https://evil.example.com"
    ]) {
      const issue = issueFor({ ...VALID_ENV, STELLAR_HORIZON_URL: horizonUrl }, "STELLAR_HORIZON_URL");

      expect(issue?.code).toBe("unsupported");
    }
  });

  it("rejects a relative Horizon URL", () => {
    expect(issueFor({ ...VALID_ENV, STELLAR_HORIZON_URL: "/horizon" }, "STELLAR_HORIZON_URL")?.code).toBe(
      "invalid"
    );
  });

  it("rejects plain http against the canonical Testnet host", () => {
    const issue = issueFor(
      { ...VALID_ENV, STELLAR_HORIZON_URL: "http://horizon-testnet.stellar.org" },
      "STELLAR_HORIZON_URL"
    );

    expect(issue?.code).toBe("invalid");
  });

  it.each([
    ["a relative explorer URL", "/explorer"],
    ["an explorer URL with no scheme", "stellar.expert/explorer/testnet"],
    ["an explorer URL on a non-http scheme", "ftp://stellar.expert/explorer/testnet"]
  ])("rejects %s", (_description, explorerUrl) => {
    expect(issueFor({ ...VALID_ENV, STELLAR_EXPLORER_URL: explorerUrl }, "STELLAR_EXPLORER_URL")?.code).toBe(
      "invalid"
    );
  });
});

describe("parseSupabaseConfig — slice independence", () => {
  it("validates the persistence slice without requiring a network contract", () => {
    const config = parseSupabaseConfig({
      SUPABASE_URL: "https://fixture.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-fixture"
    });

    expect(config.url).toBe("https://fixture.supabase.co");
    expect(config.publishableKey).toBeUndefined();
  });

  it("wraps both keys as secrets", () => {
    const config = parseSupabaseConfig(VALID_ENV);

    expect(config.serviceRoleKey.reveal()).toBe("service-role-fixture");
    expect(config.publishableKey?.reveal()).toBe("publishable-fixture");
    expect(JSON.stringify(config)).not.toContain("service-role-fixture");
  });
});

describe("parseStellarConfig — standalone entry point reads APP_ENV from the same bag (U1)", () => {
  it("admits the local network when APP_ENV=local is in the same environment", () => {
    const config = parseStellarConfig({ APP_ENV: "local", STELLAR_NETWORK: "local" });

    expect(config.network).toBe("local");
    expect(config.networkPassphrase).toBe(STELLAR_LOCAL_NETWORK_PASSPHRASE);
    expect(config.horizonUrl).toBe("http://localhost:8000");
    expect(config.rpcUrl).toBe("http://localhost:8000/rpc");
    expect(config.explorerUrl).toBeUndefined();
  });

  it("rejects the local network when APP_ENV is absent", () => {
    const issue = (() => {
      try {
        parseStellarConfig({ STELLAR_NETWORK: "local" });
      } catch (error) {
        return (error as ConfigurationError).issues[0];
      }
      throw new Error("expected local to be rejected without APP_ENV=local");
    })();

    expect(issue?.key).toBe("STELLAR_NETWORK");
    expect(issue?.detail).toContain("APP_ENV=local");
  });
});

describe("parseCampaignVaultConfig — slice independence (U1)", () => {
  const FACTORY_ID = "C" + "A".repeat(55);
  const PLATFORM_SECRET_KEY = "S" + "A".repeat(55);

  it("is disabled when no campaign vault key is set", () => {
    expect(parseCampaignVaultConfig({})).toEqual({ enabled: false });
  });

  it("enables and wraps the platform secret when the factory and the secret are both set", () => {
    const config = parseCampaignVaultConfig({
      STELLAR_CAMPAIGN_FACTORY_ID: FACTORY_ID,
      STELLAR_PLATFORM_SECRET_KEY: PLATFORM_SECRET_KEY
    });

    expect(config.enabled).toBe(true);
    if (config.enabled) {
      expect(config.factoryId).toBe(FACTORY_ID);
      expect(config.platformSecretKey.reveal()).toBe(PLATFORM_SECRET_KEY);
      expect(JSON.stringify(config)).not.toContain(PLATFORM_SECRET_KEY);
    }
  });

  it("rejects the factory id set without the platform secret", () => {
    const issue = (() => {
      try {
        parseCampaignVaultConfig({ STELLAR_CAMPAIGN_FACTORY_ID: FACTORY_ID });
      } catch (error) {
        return (error as ConfigurationError).issues[0];
      }
      throw new Error("expected a lone factory id to be rejected");
    })();

    expect(issue?.key).toBe("STELLAR_PLATFORM_SECRET_KEY");
    expect(issue?.code).toBe("missing");
  });
});
