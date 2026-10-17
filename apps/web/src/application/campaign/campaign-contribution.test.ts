import { describe, expect, it } from "vitest";
import {
  contributionAmountMessage,
  contributionPreSignError,
  MIN_CONTRIBUTION_STROOPS,
  minimumContributionStroops,
  validateContributionAmount
} from "./campaign-contribution";

const VAULT = "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";

describe("validateContributionAmount", () => {
  it("accepts the exact 10 XLM minimum", () => {
    expect(validateContributionAmount("10")).toEqual({ ok: true, stroops: MIN_CONTRIBUTION_STROOPS });
  });

  it("accepts an amount above the minimum, as a decimal-integer string", () => {
    expect(validateContributionAmount("12.5")).toEqual({ ok: true, stroops: "125000000" });
  });

  it("rejects an amount below the minimum with the dedicated reason", () => {
    expect(validateContributionAmount("9.9999999")).toEqual({ ok: false, error: "below_minimum" });
  });

  it("keeps the conversion's own failures", () => {
    expect(validateContributionAmount("abc")).toEqual({ ok: false, error: "invalid_format" });
    expect(validateContributionAmount("1.12345678")).toEqual({ ok: false, error: "too_many_decimals" });
    expect(validateContributionAmount("0")).toEqual({ ok: false, error: "not_positive" });
  });
});

// #579/S1: no contribution may exceed what is left to reach the goal.
describe("validateContributionAmount: the remaining bound", () => {
  it("refuses an amount above the remaining with its own reason", () => {
    // 10 XLM left; an 15 XLM input would overshoot it.
    expect(validateContributionAmount("15", "100000000")).toEqual({ ok: false, error: "exceeds_remaining" });
  });

  it("accepts an amount exactly at the remaining", () => {
    expect(validateContributionAmount("10", "100000000")).toEqual({ ok: true, stroops: "100000000" });
  });

  it("relaxes the 10 XLM minimum to the remaining when the remainder is smaller", () => {
    // 4.5 XLM left: the campaign can still be closed from the screen.
    expect(validateContributionAmount("4.5", "45000000")).toEqual({ ok: true, stroops: "45000000" });
    expect(minimumContributionStroops("45000000")).toBe(45_000_000n);
  });

  it("still refuses an amount below the relaxed minimum", () => {
    expect(validateContributionAmount("4", "45000000")).toEqual({ ok: false, error: "below_minimum" });
  });

  it("keeps the 10 XLM minimum when the remaining is unknown", () => {
    expect(validateContributionAmount("9.9999999")).toEqual({ ok: false, error: "below_minimum" });
    expect(minimumContributionStroops(null)).toBe(BigInt(MIN_CONTRIBUTION_STROOPS));
  });

  it("gives each refusal its own message, naming the remaining when it can", () => {
    expect(contributionAmountMessage("exceeds_remaining")).toMatch(/supera lo que falta/);
    expect(contributionAmountMessage("exceeds_remaining", "100000000")).toBe(
      "El aporte no puede superar lo que falta para alcanzar la meta: 10 XLM."
    );
  });
});

describe("contributionPreSignError", () => {
  // The real campaign `network` is the API's `config.stellar.network`: `"testnet"`
  // on Testnet (lowercase), `"local"` on the local profile. The uppercase
  // `"TESTNET"` the old fixtures used is the wallet's own label, not the API's
  // value — accepting only it was the bug that kept the review modal shut.
  it("returns no reason for a valid contribution on the real Testnet value", () => {
    expect(contributionPreSignError({ amountInput: "15", vaultAddress: VAULT, network: "testnet" })).toBeNull();
  });

  it("accepts the local network the local profile declares", () => {
    expect(contributionPreSignError({ amountInput: "15", vaultAddress: VAULT, network: "local" })).toBeNull();
  });

  it("tolerates a differently-cased network label (the wallet reports TESTNET)", () => {
    expect(contributionPreSignError({ amountInput: "15", vaultAddress: VAULT, network: "TESTNET" })).toBeNull();
    expect(contributionPreSignError({ amountInput: "15", vaultAddress: VAULT, network: " LOCAL " })).toBeNull();
  });

  it("surfaces the amount reason first, even with a missing vault", () => {
    expect(contributionPreSignError({ amountInput: "5", vaultAddress: null, network: "testnet" })).toBe(
      "El aporte mínimo es 10 XLM."
    );
  });

  it("refuses when the campaign has no vault id", () => {
    expect(contributionPreSignError({ amountInput: "15", vaultAddress: null, network: "testnet" })).toMatch(
      /no tiene una bóveda desplegada/
    );
    expect(contributionPreSignError({ amountInput: "15", vaultAddress: "   ", network: "testnet" })).toMatch(
      /no tiene una bóveda desplegada/
    );
  });

  it("refuses a campaign on a network this demo cannot sign", () => {
    expect(contributionPreSignError({ amountInput: "15", vaultAddress: VAULT, network: "PUBLIC" })).toMatch(
      /sólo firma aportes en Stellar Testnet/
    );
  });

  it("refuses an amount above the remaining before any signature (#579/S1)", () => {
    expect(
      contributionPreSignError({
        amountInput: "15",
        vaultAddress: VAULT,
        network: "testnet",
        remainingStroops: "100000000"
      })
    ).toBe("El aporte no puede superar lo que falta para alcanzar la meta: 10 XLM.");
  });

  it("allows a remainder smaller than 10 XLM to be contributed (#579/S1)", () => {
    expect(
      contributionPreSignError({
        amountInput: "4.5",
        vaultAddress: VAULT,
        network: "testnet",
        remainingStroops: "45000000"
      })
    ).toBeNull();
  });

  it("does not invent an insufficient-balance reason", () => {
    const reason = contributionPreSignError({ amountInput: "15", vaultAddress: VAULT, network: "testnet" });
    expect(reason).toBeNull();
  });
});
