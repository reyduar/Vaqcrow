import { describe, expect, it } from "vitest";
import { MIN_TESTNET_XLM, TESTNET_FUNDS_COPY, friendbotUrl, fundingState } from "./funding";

const PUBLIC_KEY = "GBXK1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ2345677Q2M";

describe("fundingState", () => {
  it("is disconnected when no public key is known", () => {
    expect(fundingState(null, null)).toBe("disconnected");
    expect(fundingState(undefined, "12.5000000")).toBe("disconnected");
    expect(fundingState("", "12.5000000")).toBe("disconnected");
  });

  it("is funded when a connected account holds at least the minimum XLM", () => {
    expect(fundingState(PUBLIC_KEY, "12.5000000")).toBe("funded");
    expect(fundingState(PUBLIC_KEY, String(MIN_TESTNET_XLM))).toBe("funded");
  });

  it("is unfunded when a connected account holds less than the minimum", () => {
    expect(fundingState(PUBLIC_KEY, "0.0000000")).toBe("unfunded");
    expect(fundingState(PUBLIC_KEY, "0.5000000")).toBe("unfunded");
  });

  it("never treats a missing or non-numeric balance as funded", () => {
    expect(fundingState(PUBLIC_KEY, null)).toBe("unfunded");
    expect(fundingState(PUBLIC_KEY, undefined)).toBe("unfunded");
    expect(fundingState(PUBLIC_KEY, "not-a-number")).toBe("unfunded");
  });
});

describe("friendbotUrl", () => {
  it("returns the generic Friendbot URL when no public key is known", () => {
    expect(friendbotUrl(null)).toBe("https://friendbot.stellar.org");
    expect(friendbotUrl()).toBe("https://friendbot.stellar.org");
  });

  it("prefills the public key as the addr query when one is known", () => {
    expect(friendbotUrl(PUBLIC_KEY)).toBe(`https://friendbot.stellar.org/?addr=${PUBLIC_KEY}`);
  });
});

describe("TESTNET_FUNDS_COPY", () => {
  it("keeps the non-custodial and no-economic-value statements", () => {
    expect(TESTNET_FUNDS_COPY.body).toContain("Vaqcrow no custodia fondos ni mueve dinero");
    expect(TESTNET_FUNDS_COPY.noValue).toContain("sin valor económico");
  });

  it("names the primary action as connecting Freighter", () => {
    expect(TESTNET_FUNDS_COPY.connect).toBe("Conectar Freighter");
  });
});
