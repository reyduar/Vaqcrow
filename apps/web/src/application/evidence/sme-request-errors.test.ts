import { describe, expect, it } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import { toSmeSubmitError } from "./sme-request-errors";

describe("toSmeSubmitError", () => {
  it("maps whitelisted field/code pairs to predefined Spanish messages", () => {
    const error = toSmeSubmitError(
      new HttpClientError("http", 422, { periodEnd: "before_start", declaredTotalArs: "not_integer" })
    );

    expect(error.fieldErrors?.periodEnd).toMatch(/anterior/);
    expect(error.fieldErrors?.declaredTotalArs).toMatch(/entero/);
    expect(error.message).toBeDefined();
  });

  it("drops unknown fields and unknown codes instead of echoing them", () => {
    const error = toSmeSubmitError(
      new HttpClientError("http", 422, { periodEnd: "<weird>", secretField: "required", periodStart: "required" })
    );

    expect(Object.keys(error.fieldErrors ?? {})).toEqual(["periodStart"]);
    expect(JSON.stringify(error)).not.toContain("secretField");
    expect(JSON.stringify(error)).not.toContain("weird");
  });

  it("never resolves inherited Object.prototype members as field messages", () => {
    const error = toSmeSubmitError(
      new HttpClientError("http", 422, { declaredTotalArs: "constructor", periodStart: "valueof", periodEnd: "required" })
    );

    expect(error.fieldErrors).toEqual({ periodEnd: "Ingresá el período final." });
    for (const message of Object.values(error.fieldErrors ?? {})) {
      expect(typeof message).toBe("string");
    }
  });

  it("gives a generic message for http failures without field errors", () => {
    const error = toSmeSubmitError(new HttpClientError("http", 500));

    expect(error.fieldErrors).toBeUndefined();
    expect(error.message).toMatch(/No se pudo enviar/);
  });

  it("maps the 409 wallet_required rejection to a wallet-specific message", () => {
    const error = toSmeSubmitError(new HttpClientError("http", 409, undefined, "wallet_required"));

    expect(error.fieldErrors).toBeUndefined();
    expect(error.message).toMatch(/wallet/i);
    expect(error.message).not.toMatch(/No se pudo enviar la solicitud/);
  });

  it("keeps the generic message for an unrelated 409", () => {
    const error = toSmeSubmitError(new HttpClientError("http", 409, undefined, "state_conflict"));

    expect(error.message).toMatch(/No se pudo enviar la solicitud/);
  });

  it("distinguishes network failures", () => {
    expect(toSmeSubmitError(new HttpClientError("network")).message).toMatch(/conexión/);
  });

  it("never leaks the message of unknown errors", () => {
    const error = toSmeSubmitError(new Error("token=abc internal"));

    expect(JSON.stringify(error)).not.toContain("abc");
    expect(error.message).toMatch(/No se pudo enviar/);
  });
});
