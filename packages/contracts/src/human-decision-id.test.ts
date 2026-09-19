import { describe, expect, expectTypeOf, it } from "vitest";
import { humanDecisionIdSchema, parseHumanDecisionId } from "./index.js";
import type { HumanDecisionId } from "./index.js";

const VALID_UUID_V4 = "123e4567-e89b-42d3-a456-426614174000";

function acceptHumanDecisionId(decisionId: HumanDecisionId): HumanDecisionId {
  return decisionId;
}

describe("human decision ID public contract", () => {
  it("exports a schema and parser that brand valid UUID v4 input", () => {
    const parsed = parseHumanDecisionId(VALID_UUID_V4);

    expect(humanDecisionIdSchema.parse(parsed)).toBe(VALID_UUID_V4);
    expect(acceptHumanDecisionId(parsed)).toBe(VALID_UUID_V4);
  });

  it("keeps arbitrary strings outside the branded type", () => {
    expectTypeOf("raw-human-decision-id").not.toMatchTypeOf<HumanDecisionId>();

    expect(parseHumanDecisionId(VALID_UUID_V4)).toBe(VALID_UUID_V4);
  });
});

describe("parseHumanDecisionId", () => {
  it.each([
    ["a malformed string", "not-a-uuid"],
    ["a non-string value", 42],
    ["a UUID v1 value", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"],
    ["a UUID v5 value", "123e4567-e89b-52d3-a456-426614174000"]
  ])("rejects %s", (_description, input) => {
    expect(() => parseHumanDecisionId(input)).toThrow();
  });
});
