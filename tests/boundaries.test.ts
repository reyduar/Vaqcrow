import { fileURLToPath } from "node:url";
import { cruise } from "dependency-cruiser";
import type { ICruiseResult } from "dependency-cruiser";
import { describe, expect, it } from "vitest";
import config from "../.dependency-cruiser.cjs";

const FIXTURE_ROOT = fileURLToPath(new URL("./fixtures/boundaries", import.meta.url));
const API_MODULES = fileURLToPath(new URL("../apps/api/node_modules", import.meta.url));
const RULE_NAME = "api-application-stays-provider-free";

async function cruiseFixture(target: string): Promise<ICruiseResult> {
  const { output } = await cruise(
    [target],
    { ...config.options, ruleSet: { forbidden: config.forbidden }, validate: true, baseDir: FIXTURE_ROOT },
    { modules: ["node_modules", API_MODULES], bustTheCache: true }
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
