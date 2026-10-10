import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildPeriodPresets,
  formatMonthName,
  formatPeriod,
  formatPeriodRange,
  formatPeriodShort,
  isWithinAvailable,
  parseMonthInput
} from "./periods";

describe("addMonths", () => {
  it("moves across a year boundary with zero-padded periods", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2026-09", -5)).toBe("2026-04");
  });
});

describe("formatPeriod", () => {
  it("renders a single month in es-AR with the year", () => {
    expect(formatPeriod("2026-10")).toBe("octubre 2026");
    expect(formatPeriod("2026-09")).toBe("septiembre 2026");
  });

  it("falls back to the raw period when it is not a month", () => {
    expect(formatPeriod("nope")).toBe("nope");
  });
});

describe("formatMonthName", () => {
  it("renders only the month name", () => {
    expect(formatMonthName("2026-08")).toBe("agosto");
  });
});

describe("formatPeriodShort", () => {
  it("renders the three-letter axis label the template uses", () => {
    expect(formatPeriodShort("2026-04")).toBe("Abr");
    expect(formatPeriodShort("2026-09")).toBe("Sep");
  });
});

describe("formatPeriodRange", () => {
  it("renders a multi-month range with an en dash and a single year", () => {
    expect(formatPeriodRange("2026-04", "2026-09")).toBe("abril – septiembre 2026");
    expect(formatPeriodRange("2026-07", "2026-09")).toBe("julio – septiembre 2026");
  });

  it("renders a single month without a dash", () => {
    expect(formatPeriodRange("2026-10", "2026-10")).toBe("octubre 2026");
  });

  it("includes both years when the range crosses one", () => {
    expect(formatPeriodRange("2025-11", "2026-01")).toBe("noviembre 2025 – enero 2026");
  });
});

describe("buildPeriodPresets", () => {
  it("builds the six-month, three-month and latest-month presets from the available range", () => {
    const presets = buildPeriodPresets({ firstPeriod: "2026-04", lastPeriod: "2026-09" });

    expect(presets.map((preset) => preset.id)).toEqual(["6m", "3m", "latest"]);
    expect(presets[0]).toMatchObject({ from: "2026-04", to: "2026-09", label: "abril – septiembre 2026" });
    expect(presets[1]).toMatchObject({ from: "2026-07", to: "2026-09", label: "julio – septiembre 2026" });
    expect(presets[2]).toMatchObject({ from: "2026-09", to: "2026-09", label: "septiembre 2026" });
  });

  it("builds no presets without available data", () => {
    expect(buildPeriodPresets({ firstPeriod: null, lastPeriod: null })).toEqual([]);
  });
});

describe("parseMonthInput", () => {
  it("accepts a YYYY-MM month and rejects anything else", () => {
    expect(parseMonthInput("2026-04")).toBe("2026-04");
    expect(parseMonthInput("2026-13")).toBeNull();
    expect(parseMonthInput("")).toBeNull();
    expect(parseMonthInput("2026-4")).toBeNull();
  });
});

describe("isWithinAvailable", () => {
  const range = { firstPeriod: "2026-04", lastPeriod: "2026-09" };

  it("bounds a period inside the available range", () => {
    expect(isWithinAvailable("2026-04", range)).toBe(true);
    expect(isWithinAvailable("2026-09", range)).toBe(true);
    expect(isWithinAvailable("2026-03", range)).toBe(false);
    expect(isWithinAvailable("2026-10", range)).toBe(false);
  });

  it("is false when there is no available data", () => {
    expect(isWithinAvailable("2026-04", { firstPeriod: null, lastPeriod: null })).toBe(false);
  });
});
