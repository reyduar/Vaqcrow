import { describe, expect, expectTypeOf, it } from "vitest";
import {
  correlationIdSchema,
  generateCorrelationId,
  parseCorrelationId
} from "./index.js";
import type { CorrelationId } from "./index.js";

const VALID_UUID_V4 = "123e4567-e89b-42d3-a456-426614174000";

function acceptCorrelationId(correlationId: CorrelationId): CorrelationId {
  return correlationId;
}

describe("correlation ID public contract", () => {
  it("exports a schema and parser that brand valid UUID v4 input", () => {
    const parsed = parseCorrelationId(VALID_UUID_V4);

    expect(correlationIdSchema.parse(parsed)).toBe(VALID_UUID_V4);
    expect(acceptCorrelationId(parsed)).toBe(VALID_UUID_V4);
  });

  it("keeps arbitrary strings outside the branded type", () => {
    expectTypeOf("raw-correlation-id").not.toMatchTypeOf<CorrelationId>();

    expect(parseCorrelationId(VALID_UUID_V4)).toBe(VALID_UUID_V4);
  });
});

describe("parseCorrelationId", () => {
  it.each([
    ["a malformed string", "not-a-uuid"],
    ["a non-string value", 42],
    ["a UUID v1 value", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"]
  ])("rejects %s", (_description, input) => {
    expect(() => parseCorrelationId(input)).toThrow();
  });
});

describe("generateCorrelationId", () => {
  it("generates 1,000 valid, distinct values", () => {
    const generated = Array.from({ length: 1_000 }, () => generateCorrelationId());

    expect(generated.every((value) => correlationIdSchema.safeParse(value).success)).toBe(true);
    expect(new Set(generated).size).toBe(1_000);
  });
});
