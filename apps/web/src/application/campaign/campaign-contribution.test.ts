import { describe, expect, it } from "vitest";
import {
  contributionPreSignError,
  MIN_CONTRIBUTION_STROOPS,
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

  it("does not invent an insufficient-balance reason", () => {
    const reason = contributionPreSignError({ amountInput: "15", vaultAddress: VAULT, network: "testnet" });
    expect(reason).toBeNull();
  });
});
