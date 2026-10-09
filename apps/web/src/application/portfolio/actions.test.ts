import { describe, expect, it } from "vitest";
import { POSITION_ACTION_COPY, positionActionFor } from "./actions";

describe("positionActionFor", () => {
  it("maps a funding position to withdraw", () => {
    expect(positionActionFor("funding")).toBe("withdraw");
  });

  it("maps a refunding position to refund", () => {
    expect(positionActionFor("refunding")).toBe("refund");
  });

  it("maps a settled position to no action", () => {
    expect(positionActionFor("settled")).toBeNull();
  });
});

describe("POSITION_ACTION_COPY", () => {
  it("reuses the shipped withdraw button and pending label", () => {
    expect(POSITION_ACTION_COPY.withdraw.button).toBe("Retirar mi aporte");
    expect(POSITION_ACTION_COPY.withdraw.pending).toBe("Retirando…");
  });

  it("reuses the shipped refund button and pending label", () => {
    expect(POSITION_ACTION_COPY.refund.button).toBe("Reembolsar");
    expect(POSITION_ACTION_COPY.refund.pending).toBe("Reembolsando…");
  });

  it("names the reviewed action after the position", () => {
    expect(POSITION_ACTION_COPY.withdraw.reviewTitle("Panadería Horizonte SRL")).toBe(
      "Retirar tu aporte de Panadería Horizonte SRL"
    );
    expect(POSITION_ACTION_COPY.refund.reviewTitle("Panadería Horizonte SRL")).toBe(
      "Reembolsar tu aporte de Panadería Horizonte SRL"
    );
  });
});
