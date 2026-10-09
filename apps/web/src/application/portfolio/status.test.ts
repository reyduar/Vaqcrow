import { describe, expect, it } from "vitest";
import { PORTFOLIO_STATUS_COPY, positionStatusBody } from "./status";

describe("PORTFOLIO_STATUS_COPY", () => {
  it("mirrors the campaign detail vocabulary exactly", () => {
    expect(PORTFOLIO_STATUS_COPY).toEqual({
      funding: "Fondeo abierto",
      settled: "Meta alcanzada",
      refunding: "Reembolso disponible"
    });
  });
});

describe("positionStatusBody", () => {
  it("renders the template's funding body with the close date as dd/mm/aaaa", () => {
    expect(positionStatusBody("funding", "2026-11-30T12:00:00.000Z")).toBe(
      "Podés retirar tu aporte hasta el cierre, el 30/11/2026."
    );
  });

  it("renders no body for settled", () => {
    expect(positionStatusBody("settled", "2026-11-30T12:00:00.000Z")).toBeUndefined();
  });

  it("renders no body for refunding", () => {
    expect(positionStatusBody("refunding", "2026-11-30T12:00:00.000Z")).toBeUndefined();
  });

  it("renders no body when the close date cannot be parsed", () => {
    expect(positionStatusBody("funding", "not-a-date")).toBeUndefined();
  });
});
