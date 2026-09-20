import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cruise } from "dependency-cruiser";
import type { ICruiseResult } from "dependency-cruiser";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import config from "../.dependency-cruiser.cjs";

const FIXTURE_ROOT = fileURLToPath(new URL("./fixtures/boundaries", import.meta.url));
const API_MODULES = fileURLToPath(new URL("../apps/api/node_modules", import.meta.url));
const WEB_MODULES = fileURLToPath(new URL("../apps/web/node_modules", import.meta.url));
const RULE_NAME = "api-application-stays-provider-free";
const WEB_RULE_NAME = "web-presentation-stays-contracts-free";
const WEB_DOMAIN_RULE_NAME = "web-never-imports-domain";
const CONTRACTS_NODE_RULE_NAME = "contracts-never-import-node-core";
const CONTRACTS_FRAMEWORK_RULE_NAME = "contracts-never-import-frameworks";
const CIRCULAR_RULE_NAME = "no-circular";
const PACKAGES_APPS_RULE_NAME = "packages-never-import-apps";
const CROSS_APP_RULE_NAME = "no-cross-app-imports";
const DOMAIN_RULE_NAME = "domain-stays-framework-free";
const WEB_SERVER_SDK_RULE_NAME = "web-never-imports-server-stellar-sdk";
const API_WALLET_SDK_RULE_NAME = "api-never-imports-wallet-sdk";
const WEB_CONSUMER_CONFIG = fileURLToPath(
  new URL("./fixtures/boundaries/apps/web/tsconfig.json", import.meta.url)
);
const PROVIDER_STUB_MODULES = fileURLToPath(
  new URL("./fixtures/boundaries/provider-stubs/node_modules", import.meta.url)
);

async function cruiseFixture(target: string, extraModules: readonly string[] = []): Promise<ICruiseResult> {
  const { output } = await cruise(
    [target],
    {
      ...config.options,
      // Fixtures live under tests/fixtures/, outside every real workspace, so resolution
      // must go through an explicit `modules` root below rather than the real package.json
      // dependency graph. Workspace deps (@vaqcrow/*) are symlinks into packages/*; with the
      // default preserveSymlinks: false, dependency-cruiser resolves them to their real
      // packages/* path relative to baseDir (../../../packages/...), which never matches this
      // ruleset's anchored `^packages/...` alternative. preserveSymlinks: true keeps the
      // resolved path inside the symlinked node_modules dir instead, matching the
      // `/@vaqcrow/<pkg>/` alternative every affected rule also carries for this exact reason.
      preserveSymlinks: true,
      ruleSet: { forbidden: config.forbidden },
      validate: true,
      baseDir: FIXTURE_ROOT
    },
    { modules: ["node_modules", API_MODULES, ...extraModules], bustTheCache: true }
  );

  if (typeof output !== "object") {
    throw new Error("expected object output from cruise(), got a string");
  }

  return output;
}

function violationsFor(result: ICruiseResult, ruleName: string) {
  return result.modules
    .flatMap((module) => module.dependencies)
    .flatMap((dependency) => dependency.rules ?? [])
    .filter((rule) => rule.name === ruleName);
}

function compileFixture(configPath: string): readonly string[] {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath));
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const configErrors = config.error === undefined ? [] : [config.error];

  return [...configErrors, ...parsed.errors, ...ts.getPreEmitDiagnostics(program)].map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  );
}

async function expectFixtureViolation(
  target: string,
  ruleName: string,
  extraModules: readonly string[] = []
): Promise<void> {
  const result = await cruiseFixture(target, extraModules);

  expect(result.summary.error).toBeGreaterThanOrEqual(1);
  expect(violationsFor(result, ruleName).length).toBeGreaterThanOrEqual(1);
}

describe("packages/contracts boundary rules", () => {
  it("flags a node:crypto import from contracts source", async () => {
    await expectFixtureViolation(
      "packages/contracts/src/imports-node-crypto.fixture.ts",
      CONTRACTS_NODE_RULE_NAME
    );
  });

  it("flags a Fastify import from contracts source", async () => {
    await expectFixtureViolation(
      "packages/contracts/src/imports-fastify.fixture.ts",
      CONTRACTS_FRAMEWORK_RULE_NAME
    );
  });

  it("compiles the contracts runtime barrel for a DOM-only consumer", () => {
    expect(compileFixture(WEB_CONSUMER_CONFIG)).toEqual([]);
  });
});

describe("apps/api/src/application boundary rule", () => {
  it("flags a runtime fastify import from application/ with the named forbidden rule", async () => {
    const result = await cruiseFixture("apps/api/src/application/imports-fastify.fixture.ts");

    expect(result.summary.error).toBeGreaterThanOrEqual(1);
    expect(violationsFor(result, RULE_NAME).length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag a type-only fastify import from application/", async () => {
    const result = await cruiseFixture("apps/api/src/application/imports-fastify-type-only.fixture.ts");

    expect(violationsFor(result, RULE_NAME)).toHaveLength(0);
  });

  it("does not flag an @vaqcrow/domain import from application/", async () => {
    const result = await cruiseFixture("apps/api/src/application/imports-domain.fixture.ts");

    expect(violationsFor(result, RULE_NAME)).toHaveLength(0);
  });

  it("flags a runtime @supabase/supabase-js import from application/ with the named forbidden rule", async () => {
    await expectFixtureViolation("apps/api/src/application/imports-supabase.fixture.ts", RULE_NAME, [
      PROVIDER_STUB_MODULES
    ]);
  });

  it("does not flag a type-only @supabase/supabase-js import from application/", async () => {
    const result = await cruiseFixture("apps/api/src/application/imports-supabase-type-only.fixture.ts", [
      PROVIDER_STUB_MODULES
    ]);

    expect(violationsFor(result, RULE_NAME)).toHaveLength(0);
  });

  it("flags a runtime stellar-sdk import from application/ with the named forbidden rule", async () => {
    await expectFixtureViolation("apps/api/src/application/imports-stellar.fixture.ts", RULE_NAME, [
      PROVIDER_STUB_MODULES
    ]);
  });

  it("flags a runtime openai import from application/ with the named forbidden rule", async () => {
    await expectFixtureViolation("apps/api/src/application/imports-llm.fixture.ts", RULE_NAME, [
      PROVIDER_STUB_MODULES
    ]);
  });
});

describe("workspace-wide boundary rules", () => {
  it("flags a mutual import between two contracts fixtures with the no-circular rule", async () => {
    await expectFixtureViolation("packages/contracts/src/circular-a.fixture.ts", CIRCULAR_RULE_NAME);
  });

  it("flags a package importing an app with the packages-never-import-apps rule", async () => {
    await expectFixtureViolation("packages/contracts/src/imports-app.fixture.ts", PACKAGES_APPS_RULE_NAME);
  });

  it("flags apps/web importing apps/api application internals with the no-cross-app-imports rule", async () => {
    await expectFixtureViolation(
      "apps/web/src/presentation/imports-api-application.fixture.ts",
      CROSS_APP_RULE_NAME,
      [WEB_MODULES]
    );
  });

  it("flags packages/domain importing an npm dependency with the domain-stays-framework-free rule", async () => {
    await expectFixtureViolation("packages/domain/src/imports-npm-dep.fixture.ts", DOMAIN_RULE_NAME);
  });
});

describe("apps/web/src/presentation boundary rule", () => {
  it("flags a runtime @vaqcrow/contracts import from presentation/ with the named forbidden rule", async () => {
    const result = await cruiseFixture("apps/web/src/presentation/imports-contracts.fixture.ts", [WEB_MODULES]);

    expect(result.summary.error).toBeGreaterThanOrEqual(1);
    expect(violationsFor(result, WEB_RULE_NAME).length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag a type-only @vaqcrow/contracts import from presentation/", async () => {
    const result = await cruiseFixture("apps/web/src/presentation/imports-contracts-type-only.fixture.ts", [
      WEB_MODULES
    ]);

    expect(violationsFor(result, WEB_RULE_NAME)).toHaveLength(0);
  });

  it("still flags an @vaqcrow/domain import from presentation/ via the existing web-never-imports-domain rule", async () => {
    const result = await cruiseFixture("apps/web/src/presentation/imports-domain.fixture.ts", [WEB_MODULES]);

    expect(result.summary.error).toBeGreaterThanOrEqual(1);
    expect(violationsFor(result, WEB_DOMAIN_RULE_NAME).length).toBeGreaterThanOrEqual(1);
  });
});

describe("Stellar SDK split across workspaces", () => {
  it("flags a runtime @stellar/stellar-sdk import from apps/web with the named forbidden rule", async () => {
    const result = await cruiseFixture("apps/web/src/infrastructure/imports-stellar-sdk.fixture.ts", [
      WEB_MODULES,
      PROVIDER_STUB_MODULES
    ]);

    expect(result.summary.error).toBeGreaterThanOrEqual(1);
    expect(violationsFor(result, WEB_SERVER_SDK_RULE_NAME).length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag a type-only @stellar/stellar-sdk import from apps/web", async () => {
    const result = await cruiseFixture(
      "apps/web/src/infrastructure/imports-stellar-sdk-type-only.fixture.ts",
      [WEB_MODULES, PROVIDER_STUB_MODULES]
    );

    expect(violationsFor(result, WEB_SERVER_SDK_RULE_NAME)).toHaveLength(0);
  });

  it("flags a runtime @stellar/freighter-api import from apps/api with the named forbidden rule", async () => {
    const result = await cruiseFixture("apps/api/src/infrastructure/imports-freighter-api.fixture.ts", [
      API_MODULES,
      PROVIDER_STUB_MODULES
    ]);

    expect(result.summary.error).toBeGreaterThanOrEqual(1);
    expect(violationsFor(result, API_WALLET_SDK_RULE_NAME).length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag a type-only @stellar/freighter-api import from apps/api", async () => {
    const result = await cruiseFixture(
      "apps/api/src/infrastructure/imports-freighter-api-type-only.fixture.ts",
      [API_MODULES, PROVIDER_STUB_MODULES]
    );

    expect(violationsFor(result, API_WALLET_SDK_RULE_NAME)).toHaveLength(0);
  });

  it("resolves both SDKs in the real app sources, so the split rules judge real dependencies", async () => {
    // A rule whose `to` pattern never matches a real resolution is a rule that
    // silently stops protecting anything. This asserts the two SDKs really are
    // reached from `apps/*/src` through node_modules — the same shape the rules
    // above forbid in the other workspace.
    const { output } = await cruise(
      ["apps/*/src"],
      { ...config.options, ruleSet: { forbidden: config.forbidden }, validate: true },
      { modules: ["node_modules"], bustTheCache: true }
    );

    if (typeof output !== "object") {
      throw new Error("expected object output from cruise(), got a string");
    }

    const resolved = output.modules
      .flatMap((module) => module.dependencies)
      .map((dependency) => dependency.resolved)
      .filter((path): path is string => typeof path === "string");

    expect(resolved.some((path) => path.includes("/@stellar/freighter-api/"))).toBe(true);
    expect(resolved.some((path) => path.includes("/@stellar/stellar-sdk/"))).toBe(true);
  });
});

describe("boundary fixtures stay outside build/typecheck/boundaries globs", () => {
  const FIXTURE_REPO_PATHS = [
    "tests/fixtures/boundaries/packages/contracts/src/imports-node-crypto.fixture.ts",
    "tests/fixtures/boundaries/packages/contracts/src/imports-fastify.fixture.ts",
    "tests/fixtures/boundaries/packages/contracts/src/circular-a.fixture.ts",
    "tests/fixtures/boundaries/packages/contracts/src/circular-b.fixture.ts",
    "tests/fixtures/boundaries/packages/contracts/src/imports-app.fixture.ts",
    "tests/fixtures/boundaries/packages/domain/src/imports-npm-dep.fixture.ts",
    "tests/fixtures/boundaries/apps/api/src/application/imports-fastify.fixture.ts",
    "tests/fixtures/boundaries/apps/api/src/application/imports-fastify-type-only.fixture.ts",
    "tests/fixtures/boundaries/apps/api/src/application/imports-domain.fixture.ts",
    "tests/fixtures/boundaries/apps/api/src/application/app-probe.fixture.ts",
    "tests/fixtures/boundaries/apps/api/src/application/imports-supabase.fixture.ts",
    "tests/fixtures/boundaries/apps/api/src/application/imports-supabase-type-only.fixture.ts",
    "tests/fixtures/boundaries/apps/api/src/application/imports-stellar.fixture.ts",
    "tests/fixtures/boundaries/apps/api/src/application/imports-llm.fixture.ts",
    "tests/fixtures/boundaries/apps/web/src/presentation/imports-contracts.fixture.ts",
    "tests/fixtures/boundaries/apps/web/src/presentation/imports-contracts-type-only.fixture.ts",
    "tests/fixtures/boundaries/apps/web/src/presentation/imports-domain.fixture.ts",
    "tests/fixtures/boundaries/apps/web/src/presentation/imports-api-application.fixture.ts",
    "tests/fixtures/boundaries/apps/web/src/infrastructure/imports-stellar-sdk.fixture.ts",
    "tests/fixtures/boundaries/apps/web/src/infrastructure/imports-stellar-sdk-type-only.fixture.ts",
    "tests/fixtures/boundaries/apps/api/src/infrastructure/imports-freighter-api.fixture.ts",
    "tests/fixtures/boundaries/apps/api/src/infrastructure/imports-freighter-api-type-only.fixture.ts",
    "tests/fixtures/boundaries/provider-stubs/node_modules/@supabase/supabase-js/index.ts",
    "tests/fixtures/boundaries/provider-stubs/node_modules/stellar-sdk/index.ts",
    "tests/fixtures/boundaries/provider-stubs/node_modules/@stellar/stellar-sdk/index.ts",
    "tests/fixtures/boundaries/provider-stubs/node_modules/@stellar/freighter-api/index.ts",
    "tests/fixtures/boundaries/provider-stubs/node_modules/openai/index.ts"
  ];

  it("fixture paths stay under tests/fixtures/boundaries/, so no real apps/*/src or packages/*/src include (used by build, lint, and typecheck) ever matches them", () => {
    for (const fixturePath of FIXTURE_REPO_PATHS) {
      expect(fixturePath.startsWith("tests/fixtures/boundaries/")).toBe(true);
      expect(fixturePath.startsWith("apps/")).toBe(false);
      expect(fixturePath.startsWith("packages/")).toBe(false);
    }
  });

  it("the real `boundaries` script glob (`apps/*/src packages/*/src`) never reaches the fixtures", async () => {
    const { output } = await cruise(
      ["apps/*/src", "packages/*/src"],
      { ...config.options, ruleSet: { forbidden: config.forbidden }, validate: true },
      { modules: ["node_modules"], bustTheCache: true }
    );

    if (typeof output !== "object") {
      throw new Error("expected object output from cruise(), got a string");
    }

    const modulePaths = output.modules.map((module) => module.source);

    for (const fixturePath of FIXTURE_REPO_PATHS) {
      expect(modulePaths).not.toContain(fixturePath);
    }
  });
});
