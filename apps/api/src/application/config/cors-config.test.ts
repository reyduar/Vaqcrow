import { describe, expect, it } from "vitest";
import type { ConfigIssue } from "./config-issue.js";
import {
  LOCAL_DEFAULT_CORS_ALLOWED_ORIGINS,
  parseCorsConfigResult
} from "./cors-config.js";
import type { EnvSource } from "./env-source.js";

/**
 * Accept / reject / default matrix for `CORS_ALLOWED_ORIGINS`.
 *
 * No test performs I/O and every fixture is a literal, so the suite is
 * reproducible with no browser or network involved — `parseCorsConfigResult`
 * only decides which origins the HTTP layer will later echo back.
 */

function issuesFrom(env: EnvSource, environment: string): readonly ConfigIssue[] {
  const result = parseCorsConfigResult(env, environment);

  if (result.ok) {
    throw new Error("expected the parser to reject this environment");
  }

  return result.issues;
}

function valueFrom(env: EnvSource, environment: string): readonly string[] {
  const result = parseCorsConfigResult(env, environment);

  if (!result.ok) {
    throw new Error("expected the parser to accept this environment");
  }

  return result.value.allowedOrigins;
}

describe("default when CORS_ALLOWED_ORIGINS is absent", () => {
  it("allows the local web origins on the local environment", () => {
    expect(valueFrom({}, "local")).toEqual(LOCAL_DEFAULT_CORS_ALLOWED_ORIGINS);
  });

  it.each(["ci", "preview", "demo"])("allows no origin on the %s environment", (environment) => {
    expect(valueFrom({}, environment)).toEqual([]);
  });

  it("treats a blank CORS_ALLOWED_ORIGINS the same as absent", () => {
    expect(valueFrom({ CORS_ALLOWED_ORIGINS: "   " }, "local")).toEqual(
      LOCAL_DEFAULT_CORS_ALLOWED_ORIGINS
    );
    expect(valueFrom({ CORS_ALLOWED_ORIGINS: "   " }, "demo")).toEqual([]);
  });
});

describe("an explicit list replaces the default", () => {
  it("replaces the local default when set, even to a single origin", () => {
    expect(
      valueFrom({ CORS_ALLOWED_ORIGINS: "https://vaqcrow-web.example.com" }, "local")
    ).toEqual(["https://vaqcrow-web.example.com"]);
  });

  it("parses a comma-separated list, trims whitespace, drops blank entries and de-duplicates", () => {
    expect(
      valueFrom(
        {
          CORS_ALLOWED_ORIGINS:
            " https://vaqcrow-web.example.com , http://localhost:3001,,https://vaqcrow-web.example.com "
        },
        "demo"
      )
    ).toEqual(["https://vaqcrow-web.example.com", "http://localhost:3001"]);
  });

  it("accepts an origin with a trailing slash, normalised to the bare origin", () => {
    expect(valueFrom({ CORS_ALLOWED_ORIGINS: "https://vaqcrow-web.example.com/" }, "demo")).toEqual([
      "https://vaqcrow-web.example.com"
    ]);
  });
});

describe("each entry must be an exact origin", () => {
  it.each([
    "https://vaqcrow-web.example.com/dashboard",
    "https://vaqcrow-web.example.com?x=1",
    "https://vaqcrow-web.example.com#section",
    "https://user:pass@vaqcrow-web.example.com",
    "*",
    "https://*.example.com",
    "ftp://vaqcrow-web.example.com",
    "vaqcrow-web.example.com",
    "not a url"
  ])("rejects %s as an invalid origin", (value) => {
    const issues = issuesFrom({ CORS_ALLOWED_ORIGINS: value }, "demo");

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ key: "CORS_ALLOWED_ORIGINS", code: "invalid" });
    expect(issues[0]?.detail).toContain("entry 1");
  });

  it("names the offending position when a later entry in the list is invalid", () => {
    const issues = issuesFrom(
      { CORS_ALLOWED_ORIGINS: "https://vaqcrow-web.example.com,not a url" },
      "demo"
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.detail).toContain("entry 2");
  });

  it("reports every invalid entry at once", () => {
    const issues = issuesFrom({ CORS_ALLOWED_ORIGINS: "not a url,*" }, "demo");

    expect(issues).toHaveLength(2);
  });
});

describe("the result is frozen", () => {
  it("freezes the config and the origin list", () => {
    const result = parseCorsConfigResult({}, "local");

    if (!result.ok) {
      throw new Error("expected the parser to accept this environment");
    }

    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.allowedOrigins)).toBe(true);
  });
});
