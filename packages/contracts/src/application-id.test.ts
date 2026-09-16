import { describe, expect, expectTypeOf, it } from "vitest";
import { applicationIdSchema, parseApplicationId } from "./index.js";
import type { ApplicationId } from "./index.js";

const VALID_UUID_V4 = "123e4567-e89b-42d3-a456-426614174000";

function acceptApplicationId(applicationId: ApplicationId): ApplicationId {
  return applicationId;
}

describe("application ID public contract", () => {
  it("exports a schema and parser that brand valid UUID v4 input", () => {
    const parsed = parseApplicationId(VALID_UUID_V4);

    expect(applicationIdSchema.parse(parsed)).toBe(VALID_UUID_V4);
    expect(acceptApplicationId(parsed)).toBe(VALID_UUID_V4);
  });

  it("keeps arbitrary strings outside the branded type", () => {
    expectTypeOf("raw-application-id").not.toMatchTypeOf<ApplicationId>();

    expect(parseApplicationId(VALID_UUID_V4)).toBe(VALID_UUID_V4);
  });
});

describe("parseApplicationId", () => {
  it.each([
    ["a malformed string", "not-a-uuid"],
    ["a non-string value", 42],
    ["a UUID v1 value", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"]
  ])("rejects %s", (_description, input) => {
    expect(() => parseApplicationId(input)).toThrow();
  });
});
