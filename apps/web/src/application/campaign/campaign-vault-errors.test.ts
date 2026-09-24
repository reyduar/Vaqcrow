import { describe, expect, it } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import { WalletError } from "@/application/ports/wallet-port";
import { campaignVaultErrorOfKind, toCampaignVaultError } from "./campaign-vault-errors";

describe("toCampaignVaultError", () => {
  it("maps every wallet failure kind to its own campaign-vault kind", () => {
    expect(toCampaignVaultError(new WalletError("rejected", "x")).kind).toBe("wallet_rejected");
    expect(toCampaignVaultError(new WalletError("unavailable", "x")).kind).toBe("wallet_unavailable");
    expect(toCampaignVaultError(new WalletError("network_mismatch", "x")).kind).toBe("wallet_network_mismatch");
    expect(toCampaignVaultError(new WalletError("unknown", "x")).kind).toBe("wallet_unknown");
  });

  it("maps a network HttpClientError to network", () => {
    expect(toCampaignVaultError(new HttpClientError("network")).kind).toBe("network");
  });

  it("maps 400 to validation", () => {
    expect(toCampaignVaultError(new HttpClientError("http", 400)).kind).toBe("validation");
  });

  it("maps 404 to not_found", () => {
    expect(toCampaignVaultError(new HttpClientError("http", 404)).kind).toBe("not_found");
  });

  it("maps a 409 campaign_not_funding to not_funding", () => {
    expect(toCampaignVaultError(new HttpClientError("http", 409, undefined, "campaign_not_funding")).kind).toBe(
      "not_funding"
    );
  });

  it("maps any other 409 to refused", () => {
    expect(toCampaignVaultError(new HttpClientError("http", 409, undefined, "application_not_approved")).kind).toBe(
      "refused"
    );
  });

  it("maps 422 to refused", () => {
    expect(toCampaignVaultError(new HttpClientError("http", 422, undefined, "rejected")).kind).toBe("refused");
  });

  it("maps 503 to unavailable", () => {
    expect(toCampaignVaultError(new HttpClientError("http", 503)).kind).toBe("unavailable");
  });

  it("maps an unrecognized status to unknown", () => {
    expect(toCampaignVaultError(new HttpClientError("http", 500)).kind).toBe("unknown");
  });

  it("maps a non-HttpClientError, non-WalletError value to unknown", () => {
    expect(toCampaignVaultError(new Error("boom")).kind).toBe("unknown");
  });

  it("authors a Spanish message with no vendor text, for every kind", () => {
    const error = campaignVaultErrorOfKind("wallet_network_mismatch");
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.message).not.toContain("Freighter is on");
  });
});
