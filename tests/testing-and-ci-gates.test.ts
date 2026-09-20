import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isLocalRequest } from "../apps/web/e2e/support/local-hosts";
import { APP_BASE_URL, STUB_API_BASE_URL } from "../apps/web/e2e/support/targets";

/**
 * Feature #15 / Task #48: deterministic proof of the testing and CI gates.
 *
 * These are meta-tests — they assert on the gate artifacts themselves (the CI
 * workflow, the Playwright config, the stub double, the script wiring) rather
 * than on application behavior. The behavior of the app is already covered by
 * the E2E suite; what #47 delivered and nothing yet proves is that the *gates*
 * stay deterministic and secret-free as the repository evolves.
 *
 * The external-request guard is exercised behaviorally: its predicate is a pure
 * function imported directly, so a regression that widens "local" to accept an
 * external host fails here, not only in a code review.
 */

function repoPath(relativePath: string): string {
  return fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
}

function readRepoFile(relativePath: string): string {
  return readFileSync(repoPath(relativePath), "utf8");
}

function readRepoJson<T>(relativePath: string): T {
  return JSON.parse(readRepoFile(relativePath)) as T;
}

/**
 * Removes block comments and whole-line `//` comments before a source-text
 * assertion, so prose that *describes* a forbidden call does not trip the check.
 *
 * Not a parser, and deliberately conservative: an inline `//` after code is left
 * alone, because a naive strip would truncate string literals such as
 * `http://127.0.0.1:4310`.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Every E2E source file (`.ts`/`.mjs`), walked from the real directory. */
function e2eSourceFiles(): readonly { readonly path: string; readonly source: string }[] {
  const root = repoPath("apps/web/e2e");
  const entries: { path: string; source: string }[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|mjs)$/.test(entry.name)) entries.push({ path: full, source: readFileSync(full, "utf8") });
    }
  };

  walk(root);
  return entries;
}

describe("external-request guard (the no-live-services safety boundary)", () => {
  it("accepts the app and the local stub double", () => {
    for (const local of [
      `${APP_BASE_URL}/request`,
      `${STUB_API_BASE_URL}/health`,
      "http://127.0.0.1:4310/sme-requests/current",
      "http://localhost:4311/approval",
      "http://[::1]:4310/health",
      "http://user:pass@127.0.0.1:4310/health"
    ]) {
      expect(isLocalRequest(local), `${local} must be accepted`).toBe(true);
    }
  });

  it("accepts non-network schemes the browser may use without leaving the machine", () => {
    expect(isLocalRequest("data:text/plain,hello")).toBe(true);
    expect(isLocalRequest("blob:http://127.0.0.1:4311/abc")).toBe(true);
  });

  it("rejects every host a demo regression could realistically reach", () => {
    for (const external of [
      "https://horizon-testnet.stellar.org/accounts/GABC",
      "https://horizon.stellar.org/",
      "https://api.openai.com/v1/chat/completions",
      "https://ppvlnwejajxpsmazvnbj.supabase.co/rest/v1/application_review",
      "https://stellar.org",
      "http://example.com/",
      "https://freighter.app"
    ]) {
      expect(isLocalRequest(external), `${external} must be rejected`).toBe(false);
    }
  });

  it("rejects hosts that merely contain a loopback string", () => {
    for (const spoofed of [
      "http://127.0.0.1.evil.com/",
      "http://localhost.evil.com/",
      "http://127.0.0.1.attacker.net/health",
      "https://notlocalhost/"
    ]) {
      expect(isLocalRequest(spoofed), `${spoofed} must be rejected`).toBe(false);
    }
  });

  it("the E2E fixture actually consumes that predicate", () => {
    const fixture = readRepoFile("apps/web/e2e/support/local-only.ts");

    expect(fixture).toContain('from "./local-hosts"');
    expect(fixture).toContain("isLocalRequest");
  });
});

describe("CI workflow (pull-request gates)", () => {
  const workflow = readRepoFile(".github/workflows/ci.yml");

  it("runs on pull requests and pushes to main", () => {
    expect(workflow).toMatch(/^on:\s*$/m);
    expect(workflow).toMatch(/^\s*pull_request:\s*$/m);
    expect(workflow).toMatch(/^\s*branches:\s*\[main\]\s*$/m);
  });

  it("requests only read access to the repository", () => {
    expect(workflow).toMatch(/^permissions:\s*$/m);
    expect(workflow).toMatch(/^\s*contents:\s*read\s*$/m);
    expect(workflow).not.toMatch(/^\s*(write-all|contents:\s*write)\s*$/m);
  });

  it("installs with a frozen lockfile in every job that installs", () => {
    const installLines = workflow.match(/^\s*run:\s*pnpm install.*$/gm) ?? [];

    expect(installLines.length).toBeGreaterThanOrEqual(2);
    for (const line of installLines) {
      expect(line, `"${line.trim()}" must pin the lockfile`).toContain("--frozen-lockfile");
    }
  });

  it("runs the documented verify gate and the Playwright suite", () => {
    expect(workflow).toMatch(/^\s*run:\s*pnpm run verify\s*$/m);
    expect(workflow).toMatch(/^\s*run:\s*pnpm run test:e2e\s*$/m);
    expect(workflow).toMatch(/^\s*run:\s*pnpm run test:e2e:install\s*$/m);
  });

  it("never references a repository secret or an external endpoint", () => {
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).not.toMatch(/https?:\/\//);
  });

  it("keeps the credential-gated integration suite out of the pull-request path", () => {
    expect(workflow).not.toContain("test:integration");
  });
});

describe("Playwright determinism", () => {
  const config = withoutComments(readRepoFile("apps/web/playwright.config.ts"));

  it("runs one browser, one worker, with no retries and no focused tests", () => {
    expect(config).toMatch(/browserName:\s*"chromium"/);
    expect(config).toMatch(/workers:\s*1\b/);
    expect(config).toMatch(/fullyParallel:\s*false/);
    expect(config).toMatch(/retries:\s*0\b/);
    expect(config).toMatch(/forbidOnly:\s*Boolean\(process\.env\.CI\)/);
  });

  it("never configures a second browser engine", () => {
    expect(config).not.toMatch(/firefox|webkit/i);
  });

  it("collects tests from the dedicated e2e directory", () => {
    expect(config).toMatch(/testDir:\s*"\.\/e2e"/);
  });

  it("points every webServer and the base URL at loopback", () => {
    for (const url of [APP_BASE_URL, STUB_API_BASE_URL]) {
      expect(new URL(url).hostname).toBe("127.0.0.1");
    }

    expect(config).toContain("127.0.0.1");
    expect(config).not.toMatch(/0\.0\.0\.0/);
  });
});

describe("local stub double determinism", () => {
  const stub = withoutComments(readRepoFile("apps/web/e2e/support/stub-api-server.mjs"));

  it("contains no clock or randomness source", () => {
    expect(stub).not.toMatch(/\bDate\.now\b/);
    expect(stub).not.toMatch(/\bnew Date\b/);
    expect(stub).not.toMatch(/\bMath\.random\b/);
  });

  it("pins the server-side literals the UI asserts on", () => {
    expect(stub).toMatch(/const DECIDED_AT = "/);
    expect(stub).toMatch(/const CORRELATION_ID = "/);
  });

  it("listens on loopback only", () => {
    expect(stub).toContain("127.0.0.1");
    expect(stub).not.toMatch(/0\.0\.0\.0/);
  });
});

describe("script and task wiring", () => {
  interface PackageManifest {
    readonly scripts?: Readonly<Record<string, string>>;
  }
  interface TurboConfig {
    readonly tasks: Readonly<Record<string, { readonly dependsOn?: readonly string[]; readonly cache?: boolean }>>;
  }

  const root = readRepoJson<PackageManifest>("package.json");
  const web = readRepoJson<PackageManifest>("apps/web/package.json");
  const turbo = readRepoJson<TurboConfig>("turbo.json");

  it("exposes the documented E2E commands at the root and in the web workspace", () => {
    expect(root.scripts?.["test:e2e"]).toBe("turbo run test:e2e");
    expect(root.scripts?.["test:e2e:install"]).toContain("@vaqcrow/web");
    expect(web.scripts?.["test:e2e"]).toBe("playwright test");
    expect(web.scripts?.["test:e2e:install"]).toContain("playwright install");
  });

  it("keeps the fast verify gate free of browser and credential-gated suites", () => {
    const verify = root.scripts?.["verify"] ?? "";

    expect(verify).toContain("pnpm run test");
    expect(verify).not.toContain("test:e2e");
    expect(verify).not.toContain("test:integration");
    expect(root.scripts?.["test"]).toBe("turbo run test");
  });

  it("builds the web workspace dependencies before starting the E2E server", () => {
    const task = turbo.tasks["test:e2e"];

    expect(task).toBeDefined();
    expect(task?.dependsOn).toEqual(["^build"]);
    expect(task?.cache).toBe(false);
  });
});

describe("documented commands", () => {
  const readme = readRepoFile("README.md");

  it("documents how to install the browser and run the E2E suite", () => {
    expect(readme).toContain("pnpm run test:e2e:install");
    expect(readme).toContain("pnpm run test:e2e");
  });

  it("documents that CI installs with a frozen lockfile", () => {
    expect(readme).toContain("--frozen-lockfile");
  });
});

describe("E2E sources stay outside the enforced workspace boundaries", () => {
  it("never imports the backend-authoritative domain package", () => {
    for (const file of e2eSourceFiles()) {
      expect(file.source, `${file.path} must not import @vaqcrow/domain`).not.toMatch(/@vaqcrow\/domain/);
    }
  });

  it("covers every E2E source file with the walk (guards against a silent empty scan)", () => {
    const files = e2eSourceFiles();

    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("stub-api-server.mjs"),
        expect.stringContaining("local-only.ts"),
        expect.stringContaining("local-hosts.ts"),
        expect.stringContaining("targets.ts"),
        expect.stringContaining("guided-journey.spec.ts"),
        expect.stringContaining("human-decision.spec.ts")
      ])
    );
  });
});
