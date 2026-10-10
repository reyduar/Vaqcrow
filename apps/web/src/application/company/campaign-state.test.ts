import { describe, expect, it } from "vitest";
import { MY_CAMPAIGN_STATE_COPY, MY_CAMPAIGN_STATE_TONE, vaultStatusTitle } from "./campaign-state";

describe("campaign state vocabulary", () => {
  it("mirrors the portfolio status copy exactly", () => {
    expect(MY_CAMPAIGN_STATE_COPY).toEqual({
      funding: "Fondeo abierto",
      settled: "Meta alcanzada",
      refunding: "Reembolso disponible"
    });
  });

  it("assigns the same tones the portfolio card uses", () => {
    expect(MY_CAMPAIGN_STATE_TONE).toEqual({
      funding: "info",
      settled: "neutral",
      refunding: "caution"
    });
  });

  it("joins the state label with the contributors count in singular and plural", () => {
    expect(vaultStatusTitle("funding", 38)).toBe("Fondeo abierto · 38 aportantes");
    expect(vaultStatusTitle("funding", 1)).toBe("Fondeo abierto · 1 aportante");
    expect(vaultStatusTitle("settled", 0)).toBe("Meta alcanzada · 0 aportantes");
  });
});
