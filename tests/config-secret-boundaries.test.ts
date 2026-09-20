import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Feature #14 promises two things about boundaries: server secrets stay out of
 * browser bundles, and the environment is validated where it is consumed.
 *
 * These tests enforce the browser half at the source level, and they derive
 * their input from the API's own configuration contract rather than a
 * hand-maintained list — a boundary test that silently stops matching is worse
 * than no test, so the scanners are themselves asserted to find something.
 *
 * Note: `tests/**` is executed by `pnpm run test:boundaries` but is outside
 * `turbo run lint` and `turbo run typecheck` (there is no root tsconfig), so
 * this file gets no static analysis. Keep it explicit.
 */

const WEB_SRC = fileURLToPath(new URL("../apps/web/src", import.meta.url));
const API_CONFIG_SRC = fileURLToPath(new URL("../apps/api/src/application/config", import.meta.url));

/**
 * Next.js inlines only `NEXT_PUBLIC_*` into the client bundle, so restricting
 * web sources to that prefix is the enforceable form of "no server secret in a
 * browser bundle": a non-public key read anywhere in `apps/web/src` is the
 * shape a leak would take.
 */
const WEB_CLIENT_PREFIX = "NEXT_PUBLIC_";

/**
 * Names that identify a credential rather than a public value. Derived keys are
 * filtered through this so the scan targets secrets specifically:
 * `SUPABASE_PUBLISHABLE_KEY` is deliberately browser-safe and is not a leak.
 */
const SECRET_SHAPED = /SECRET|TOKEN|PASSWORD|PASSPHRASE|CREDENTIAL|PRIVATE_KEY|SERVICE_ROLE|AUTHORIZATION/;

function sourceFiles(root: string): readonly string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (/\.tsx?$/.test(entry.name)) {
        found.push(path);
      }
    }
  };

  walk(root);
  return found;
}

/** Environment keys read through `process.env` in the given files. */
function environmentKeysReadIn(files: readonly string[]): readonly string[] {
  const patterns = [
    /process\.env\[\s*["']([^"']+)["']\s*\]/g,
    /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g
  ];
  const keys: string[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const key = match[1];
        if (key) {
          keys.push(key);
        }
      }
    }
  }

  return keys;
}

/**
 * Every server-side environment key, read out of the API's configuration
 * contract itself: literals passed to `readPresent`/`requirePresent`. On this
 * branch every key the process reads goes through one of those two helpers, so
 * this list cannot drift away from the contract.
 */
function serverEnvironmentKeys(): readonly string[] {
  const keys = new Set<string>();

  for (const file of sourceFiles(API_CONFIG_SRC)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!/(readPresent|requirePresent)\(/.test(line)) {
        continue;
      }
      for (const match of line.matchAll(/"([A-Z][A-Z0-9_]+)"/g)) {
        const key = match[1];
        if (key) {
          keys.add(key);
        }
      }
    }
  }

  return [...keys];
}

const SERVER_KEYS = [...serverEnvironmentKeys()];
const SERVER_SECRET_KEYS = SERVER_KEYS.filter((key) => SECRET_SHAPED.test(key));

describe("the scanners themselves", () => {
  it("derives the API's server environment surface, including its service-role credential", () => {
    expect(SERVER_KEYS.length).toBeGreaterThanOrEqual(6);
    expect(SERVER_KEYS).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(SERVER_SECRET_KEYS).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("finds the environment key the web app actually reads", () => {
    expect(environmentKeysReadIn(sourceFiles(WEB_SRC))).toContain(`${WEB_CLIENT_PREFIX}API_BASE_URL`);
  });
});

describe("the browser boundary", () => {
  it("lets apps/web read only NEXT_PUBLIC_* environment keys", () => {
    const offenders = environmentKeysReadIn(sourceFiles(WEB_SRC)).filter(
      (key) => !key.startsWith(WEB_CLIENT_PREFIX)
    );

    expect(
      offenders,
      `\`apps/web/src\` reads non-public environment keys: ${offenders.join(", ")}. ` +
        "Next.js inlines only NEXT_PUBLIC_* into the client bundle, but a server key read here is " +
        "one refactor away from being inlined, so the boundary is enforced at the source."
    ).toEqual([]);
  });

  it("keeps every server-side credential name out of apps/web sources", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(WEB_SRC)) {
      const text = readFileSync(file, "utf8");
      for (const key of SERVER_SECRET_KEYS) {
        if (text.includes(key)) {
          offenders.push(`${relative(WEB_SRC, file)} (${key})`);
        }
      }
    }

    expect(
      offenders,
      `server credential names appear in web sources: ${offenders.join(", ")}. ` +
        "No browser file needs them; the web app reaches the backend over HTTP."
    ).toEqual([]);
  });
});
