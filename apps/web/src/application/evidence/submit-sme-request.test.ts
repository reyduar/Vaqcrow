import type { SmeRequest } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { buildSmeRequest, submitSmeRequest } from "./submit-sme-request";

const VALUES = { declaredTotalArs: "1200000", periodStart: "2026-01", periodEnd: "2026-08" };
const REF = "sme:SYN-TEST";

const SAVED: SmeRequest = {
  smeReference: REF,
  declaredTotalArs: 1_200_000,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

function gateway(submit: SmeRequestGateway["submit"]): SmeRequestGateway {
  return { submit, loadCurrent: vi.fn() };
}

describe("buildSmeRequest", () => {
  it("converts the amount string to an integer and builds the contract shape", () => {
    expect(buildSmeRequest(VALUES, REF)).toEqual({ ok: true, request: SAVED });
  });

  it.each(["12.5", "-3", "1e6", "", " 12", "abc", "99999999999999999999"])(
    "rejects %j before anything is sent",
    (declaredTotalArs) => {
      const result = buildSmeRequest({ ...VALUES, declaredTotalArs }, REF);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.fieldErrors?.declaredTotalArs).toBeDefined();
    }
  );
});

describe("submitSmeRequest", () => {
  it("sends the built request and returns the saved one", async () => {
    const submit = vi.fn<SmeRequestGateway["submit"]>().mockResolvedValue(SAVED);

    const result = await submitSmeRequest(gateway(submit), VALUES, REF);

    expect(submit).toHaveBeenCalledWith(SAVED);
    expect(result).toEqual({ ok: true, request: SAVED });
  });

  it("does not call the gateway for a non-integer amount", async () => {
    const submit = vi.fn<SmeRequestGateway["submit"]>();

    const result = await submitSmeRequest(gateway(submit), { ...VALUES, declaredTotalArs: "1.5" }, REF);

    expect(submit).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it("returns a sanitized error (never success) when the backend rejects", async () => {
    const submit = vi
      .fn<SmeRequestGateway["submit"]>()
      .mockRejectedValue(new HttpClientError("http", 422, { periodEnd: "before_start" }));

    const result = await submitSmeRequest(gateway(submit), VALUES, REF);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fieldErrors?.periodEnd).toMatch(/anterior/);
  });

  it("treats unexpected failures (e.g. contract parse errors) as a generic failure", async () => {
    const submit = vi.fn<SmeRequestGateway["submit"]>().mockRejectedValue(new Error("zod internals"));

    const result = await submitSmeRequest(gateway(submit), VALUES, REF);

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("zod internals");
  });
});
