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
const WEB_CONSUMER_CONFIG = fileURLToPath(
  new URL("./fixtures/boundaries/apps/web/tsconfig.json", import.meta.url)
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

async function expectFixtureViolation(target: string, ruleName: string): Promise<void> {
  const result = await cruiseFixture(target);

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

describe("web boundary fixtures stay outside build/typecheck/boundaries globs", () => {
  const WEB_FIXTURE_REPO_PATHS = [
    "tests/fixtures/boundaries/apps/web/src/presentation/imports-contracts.fixture.ts",
    "tests/fixtures/boundaries/apps/web/src/presentation/imports-contracts-type-only.fixture.ts",
    "tests/fixtures/boundaries/apps/web/src/presentation/imports-domain.fixture.ts"
  ];

  it("fixture paths do not fall under apps/web/src/, so apps/web/tsconfig.json's `src/**/*` include (used by build and typecheck) never matches them", () => {
    for (const fixturePath of WEB_FIXTURE_REPO_PATHS) {
      expect(fixturePath.startsWith("apps/web/src/")).toBe(false);
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

    for (const fixturePath of WEB_FIXTURE_REPO_PATHS) {
      expect(modulePaths).not.toContain(fixturePath);
    }
  });
});
