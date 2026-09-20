import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { ConfigurationError } from "./config-issue.js";
import { isSensitiveKey, redactForLog, redactText } from "./redaction.js";
import { REDACTED_MARKER, Secret } from "./secret.js";

/** Synthetic credentials. None of these is a real value or a real key. */
const SECRET_FIXTURE = "fixture-secret-value";
const JWT_FIXTURE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiZml4dHVyZSJ9.Zml4dHVyZXNpZ25hdHVyZXZhbHVl";

describe("Secret", () => {
  it("reveals the raw value only through reveal()", () => {
    const secret = new Secret(SECRET_FIXTURE);

    expect(secret.reveal()).toBe(SECRET_FIXTURE);
  });

  it("collapses every ordinary formatting path to the marker", () => {
    const secret = new Secret(SECRET_FIXTURE);

    expect(String(secret)).toBe(REDACTED_MARKER);
    expect(`${secret}`).toBe(REDACTED_MARKER);
    expect("key=" + secret).toBe(`key=${REDACTED_MARKER}`);
    expect(JSON.stringify(secret)).toBe(JSON.stringify(REDACTED_MARKER));
    expect(inspect(secret)).not.toContain(SECRET_FIXTURE);
  });
});

describe("isSensitiveKey", () => {
  it("ignores case and separators", () => {
    expect(isSensitiveKey("SUPABASE_SERVICE_ROLE_KEY")).toBe(true);
    expect(isSensitiveKey("supabaseServiceRoleKey")).toBe(true);
    expect(isSensitiveKey("SUPABASE_PUBLISHABLE_KEY")).toBe(true);
    expect(isSensitiveKey("api-key")).toBe(true);
    expect(isSensitiveKey("authorization")).toBe(true);
  });

  it("leaves traceability identifiers alone", () => {
    expect(isSensitiveKey("correlationId")).toBe(false);
    expect(isSensitiveKey("applicationId")).toBe(false);
    expect(isSensitiveKey("SUPABASE_URL")).toBe(false);
    expect(isSensitiveKey("LOG_LEVEL")).toBe(false);
  });
});

describe("redactText", () => {
  it("masks a JWT, a Stellar seed and a long opaque credential", () => {
    const seed = `S${"A".repeat(55)}`;
    const opaque = "0123456789".repeat(4);
    const text = `jwt=${JWT_FIXTURE} seed=${seed} opaque=${opaque}`;

    const redacted = redactText(text);

    expect(redacted).not.toContain(JWT_FIXTURE);
    expect(redacted).not.toContain(seed);
    expect(redacted).not.toContain(opaque);
    expect(redacted.match(/\[redacted\]/g)).toHaveLength(3);
  });

  it("does not mask a dashed identifier the demo needs for traceability", () => {
    const correlationId = "7a1f4d92-2c31-4a5e-9b0c-1f2e3d4c5b6a";

    expect(redactText(`correlation=${correlationId}`)).toBe(`correlation=${correlationId}`);
  });
});

describe("redactForLog", () => {
  it("unwraps a Secret wherever it is nested", () => {
    const secret = new Secret(SECRET_FIXTURE);
    const redacted = redactForLog({ outer: { inner: secret }, list: [secret] });

    expect(JSON.stringify(redacted)).not.toContain(SECRET_FIXTURE);
    expect(JSON.stringify(redacted).match(/\[redacted\]/g)).toHaveLength(2);
  });

  it("masks by key name and preserves non-sensitive neighbours", () => {
    const redacted = redactForLog({
      SUPABASE_SERVICE_ROLE_KEY: "plain-fixture",
      apiKey: "plain-fixture",
      token: "plain-fixture",
      passphrase: "plain-fixture",
      correlationId: "corr-1",
      applicationId: "app-1"
    }) as Record<string, unknown>;

    expect(redacted["SUPABASE_SERVICE_ROLE_KEY"]).toBe(REDACTED_MARKER);
    expect(redacted["apiKey"]).toBe(REDACTED_MARKER);
    expect(redacted["token"]).toBe(REDACTED_MARKER);
    expect(redacted["passphrase"]).toBe(REDACTED_MARKER);
    expect(redacted["correlationId"]).toBe("corr-1");
    expect(redacted["applicationId"]).toBe("app-1");
  });

  it("redacts a failure report without losing the offending key", () => {
    const error = new ConfigurationError("API configuration", [
      { key: "SUPABASE_SERVICE_ROLE_KEY", code: "missing", detail: "required but not set" }
    ]);

    const redacted = redactForLog(error) as { name: string; message: string };

    expect(redacted.name).toBe("ConfigurationError");
    expect(redacted.message).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(redacted.message).toContain("required but not set");
  });

  it("caps depth instead of hanging on a cyclic structure", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;

    expect(() => redactForLog(cyclic)).not.toThrow();
    expect(() => JSON.stringify(redactForLog(cyclic))).not.toThrow();
  });

  it("passes through primitives and serialises dates", () => {
    expect(redactForLog(42)).toBe(42);
    expect(redactForLog(true)).toBe(true);
    expect(redactForLog(null)).toBeNull();
    expect(redactForLog(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
  });
});
