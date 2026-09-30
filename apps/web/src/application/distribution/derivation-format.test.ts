import { describe, expect, it } from "vitest";
import { formatArs, formatRateBps } from "./derivation-format";

describe("derivation formatting", () => {
  it("renders whole pesos with es-AR grouping and keeps precision above 2^53", () => {
    expect(formatArs("3745800")).toBe("ARS 3.745.800");
    expect(formatArs("9007199254740993")).toBe("ARS 9.007.199.254.740.993");
  });

  it("renders basis points as a percentage", () => {
    expect(formatRateBps(450)).toBe("4,50 %");
    expect(formatRateBps(10_000)).toBe("100,00 %");
  });
});
