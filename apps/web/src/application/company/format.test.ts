import { describe, expect, it } from "vitest";
import {
  formatApproxXlmAmount,
  formatArsAmount,
  formatDeadlineDate,
  formatMonthName,
  formatMonthYear,
  formatShortAddress,
  formatXlmAmount,
  formatXlmValue
} from "./format";

describe("company format", () => {
  it("formats integer ARS in es-AR with thousands separators", () => {
    expect(formatArsAmount(9_450_000)).toBe("ARS 9.450.000");
    expect(formatArsAmount(0)).toBe("ARS 0");
    expect(formatArsAmount(168_561)).toBe("ARS 168.561");
  });

  it("formats a canonical XLM string with exactly seven fraction digits", () => {
    expect(formatXlmAmount("1.2500000")).toBe("1,2500000 XLM");
    expect(formatXlmValue("4.0850000")).toBe("4,0850000");
  });

  it("marks the XLM conversion as approximate", () => {
    expect(formatApproxXlmAmount("1.2500000")).toBe("≈ 1,2500000 XLM");
  });

  it("keeps a non-numeric XLM string unchanged rather than inventing a number", () => {
    expect(formatXlmAmount("sin-dato")).toBe("sin-dato");
    expect(formatApproxXlmAmount("sin-dato")).toBe("≈ sin-dato XLM");
  });

  it("formats an ISO deadline as dd/mm/aaaa in UTC", () => {
    expect(formatDeadlineDate("2026-11-30T12:00:00.000Z")).toBe("30/11/2026");
    expect(formatDeadlineDate("2026-01-01T00:00:00-03:00")).toBe("01/01/2026");
  });

  it("returns an empty string for an unparseable deadline", () => {
    expect(formatDeadlineDate("not-a-date")).toBe("");
  });

  it("formats a YYYY-MM period as a capitalised month name", () => {
    expect(formatMonthName("2026-08")).toBe("Agosto");
    expect(formatMonthName("2026-01")).toBe("Enero");
    expect(formatMonthName("2026-12")).toBe("Diciembre");
  });

  it("formats a YYYY-MM period as month name plus year", () => {
    expect(formatMonthYear("2026-08")).toBe("Agosto 2026");
  });

  it("returns an invalid period unchanged instead of inventing a month", () => {
    expect(formatMonthName("2026-13")).toBe("2026-13");
    expect(formatMonthYear("2026-13")).toBe("2026-13");
  });

  it("shortens a Stellar address to its first and last four characters", () => {
    expect(formatShortAddress("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2")).toBe("CDLZ…N4B2");
    expect(formatShortAddress("CDLZ")).toBe("CDLZ");
  });
});
