import { describe, expect, it } from "vitest";
import { buildMonthlySalesFeedParitySnapshot } from "./monthly-sales-feed-parity.js";

describe("monthly sales feed fixture parity", () => {
  it("keeps the API historical dataset aligned with the canonical web sales fixture", () => {
    const snapshot = buildMonthlySalesFeedParitySnapshot();

    expect(snapshot.apiPeriods).toEqual(snapshot.webPeriods);
  });
});
