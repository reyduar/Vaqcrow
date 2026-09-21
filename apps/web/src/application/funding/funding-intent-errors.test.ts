import { describe, expect, it } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import { WalletError } from "@/application/ports/wallet-port";
import { fundingErrorOfKind, toFundingSubmitError } from "./funding-intent-errors";

describe("toFundingSubmitError", () => {
  it("maps 400 to validation", () => {
    expect(toFundingSubmitError(new HttpClientError("http", 400, undefined, "invalid_request")).kind).toBe(
      "validation"
    );
  });

  it("maps an unfunded source account distinctly from a missing intent", () => {
    const account = toFundingSubmitError(new HttpClientError("http", 404, undefined, "account_not_found"));
    const missing = toFundingSubmitError(new HttpClientError("http", 404, undefined, "not_found"));

    expect(account.kind).toBe("account_not_found");
    expect(missing.kind).toBe("not_found");
    expect(account.message).not.toBe(missing.message);
  });

  it("maps a 422 to a rejected signed envelope", () => {
    const result = toFundingSubmitError(new HttpClientError("http", 422, undefined, "xdr_rejected"));

    expect(result.kind).toBe("xdr_rejected");
    expect(result.message).toMatch(/rechaz/i);
  });

  it("maps idempotency_conflict distinctly from a generic conflict", () => {
    const replay = toFundingSubmitError(new HttpClientError("http", 409, undefined, "idempotency_conflict"));
    const conflict = toFundingSubmitError(new HttpClientError("http", 409));

    expect(replay.kind).toBe("idempotency_conflict");
    expect(conflict.kind).toBe("conflict");
    expect(replay.message).not.toBe(conflict.message);
  });

  it("maps 503 to unavailable", () => {
    expect(toFundingSubmitError(new HttpClientError("http", 503, undefined, "unavailable")).kind).toBe("unavailable");
  });

  it("maps a network failure to a retryable error that admits the outcome is unknown", () => {
    const result = toFundingSubmitError(new HttpClientError("network"));

    expect(result.kind).toBe("network");
    expect(result.message).toMatch(/no se pudo confirmar/i);
    expect(result.recoverable).toBe(true);
  });

  it("maps a declined signature to a recoverable error that keeps the prepared intent", () => {
    const result = toFundingSubmitError(new WalletError("rejected", "The user rejected this request."));

    expect(result.kind).toBe("wallet_rejected");
    expect(result.recoverable).toBe(true);
    expect(result.message).toMatch(/rechazaste la firma/i);
  });

  it("maps every wallet failure kind to a distinct, non-leaking message", () => {
    const kinds = (["rejected", "unavailable", "network_mismatch", "unknown"] as const).map(
      (kind) => toFundingSubmitError(new WalletError(kind, "vendor text that must not travel"))
    );

    expect(kinds.map((error) => error.kind)).toEqual([
      "wallet_rejected",
      "wallet_unavailable",
      "wallet_network_mismatch",
      "wallet_unknown"
    ]);
    for (const error of kinds) {
      expect(error.message).not.toContain("vendor");
      expect(error.message.length).toBeGreaterThan(0);
    }
    expect(new Set(kinds.map((error) => error.message)).size).toBe(4);
  });

  it("marks the failures that require re-preparing as not recoverable", () => {
    expect(toFundingSubmitError(new HttpClientError("http", 400)).recoverable).toBe(false);
    expect(toFundingSubmitError(new HttpClientError("http", 404, undefined, "account_not_found")).recoverable).toBe(false);
    expect(toFundingSubmitError(new HttpClientError("http", 409, undefined, "idempotency_conflict")).recoverable).toBe(
      false
    );
  });

  it("maps anything else, including a malformed response, to unknown without leaking text", () => {
    const result = toFundingSubmitError(new Error("secret server text"));

    expect(result.kind).toBe("unknown");
    expect(result.message).not.toContain("secret");
  });
});

describe("fundingErrorOfKind", () => {
  it("carries the authored message and recoverability for a kind", () => {
    expect(fundingErrorOfKind("not_connected").recoverable).toBe(true);
    expect(fundingErrorOfKind("validation").recoverable).toBe(false);
  });
});
