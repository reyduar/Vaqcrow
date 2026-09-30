import { describe, expect, it } from "vitest";
import { DERIVATION_FAILURE_REASONS } from "@/application/ports/revenue-share-distribution-gateway";
import { derivationFailureMessage } from "./derivation-failure-copy";

describe("derivationFailureMessage", () => {
  it("has its own non-empty Spanish sentence for every reason the API can give", () => {
    const messages = DERIVATION_FAILURE_REASONS.map(derivationFailureMessage);

    expect(new Set(messages).size).toBe(DERIVATION_FAILURE_REASONS.length);
    for (const message of messages) expect(message.length).toBeGreaterThan(20);
  });

  it("tells the person to connect the SME's account when the source is not the SME", () => {
    expect(derivationFailureMessage("source_not_sme")).toBe(
      "Conecte en Freighter la cuenta de la PyME de esta campaña: solo esa cuenta puede firmar la distribución."
    );
  });

  it("does not claim the campaign is settled when it is not", () => {
    expect(derivationFailureMessage("campaign_not_settled")).toMatch(/todavía no se liquidó/i);
  });
});
