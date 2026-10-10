import { describe, expect, it } from "vitest";
import { contractExplorerUrl, transactionExplorerUrl } from "./explorer-url.js";

const BASE = "https://stellar.expert/explorer/testnet";
const HASH = "a".repeat(64);
const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

describe("explorer links", () => {
  it("builds a transaction link under the base", () => {
    expect(transactionExplorerUrl(BASE, HASH)).toBe(`${BASE}/tx/${HASH}`);
  });

  it("builds a contract link under the base", () => {
    expect(contractExplorerUrl(BASE, VAULT)).toBe(`${BASE}/contract/${VAULT}`);
  });

  it("never doubles the separator when a caller passes a trailing slash", () => {
    expect(transactionExplorerUrl(`${BASE}//`, HASH)).toBe(`${BASE}/tx/${HASH}`);
    expect(contractExplorerUrl(`${BASE}/`, VAULT)).toBe(`${BASE}/contract/${VAULT}`);
  });
});
