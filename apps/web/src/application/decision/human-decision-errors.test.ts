import { describe, expect, it } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import { toDecisionSubmitError } from "./human-decision-errors";

describe("toDecisionSubmitError", () => {
  it("maps state_conflict to a state conflict that says nothing was recorded", () => {
    const result = toDecisionSubmitError(new HttpClientError("http", 409, undefined, "state_conflict"));
    expect(result.kind).toBe("state_conflict");
    expect(result.message).toMatch(/ya no está pendiente/i);
  });

  it("maps idempotency_conflict distinctly from state_conflict", () => {
    const result = toDecisionSubmitError(new HttpClientError("http", 409, undefined, "idempotency_conflict"));
    expect(result.kind).toBe("idempotency_conflict");
  });

  it("maps a 409 without a known code to a generic conflict instead of guessing", () => {
    expect(toDecisionSubmitError(new HttpClientError("http", 409)).kind).toBe("conflict");
  });

  it("maps 400 to validation, 404 to not_found, 503 to unavailable", () => {
    expect(toDecisionSubmitError(new HttpClientError("http", 400, undefined, "invalid_request")).kind).toBe("validation");
    expect(toDecisionSubmitError(new HttpClientError("http", 404, undefined, "not_found")).kind).toBe("not_found");
    expect(toDecisionSubmitError(new HttpClientError("http", 503, undefined, "unavailable")).kind).toBe("unavailable");
  });

  it("maps network failures to a retryable network error that admits the outcome is unknown", () => {
    const result = toDecisionSubmitError(new HttpClientError("network"));
    expect(result.kind).toBe("network");
    expect(result.message).toMatch(/no se pudo confirmar/i);
  });

  it("maps anything else (including malformed responses) to unknown without leaking text", () => {
    const result = toDecisionSubmitError(new Error("secret server text"));
    expect(result.kind).toBe("unknown");
    expect(result.message).not.toContain("secret");
  });
});
