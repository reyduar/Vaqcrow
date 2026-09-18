import type { SmeRequest } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import { HttpSmeRequestGateway } from "./http-sme-request-gateway";

const REQUEST: SmeRequest = {
  smeReference: "sme:SYN-1",
  declaredTotalArs: 9_700_000,
  periodStart: "2026-01",
  periodEnd: "2026-03",
  simuladoLabel: "SIMULADO"
};

const PERIOD = {
  period: "2026-01",
  amountArs: 3_200_000,
  status: "reported",
  evidenceRef: "sales:1",
  simuladoLabel: "SIMULADO"
};

function client(body: unknown, status = 200) {
  const send = vi.fn().mockResolvedValue({ status, body });
  return { port: { send } as unknown as HttpClientPort, send };
}

describe("HttpSmeRequestGateway", () => {
  it("POSTs the request to the assumed /sme-requests placeholder path and parses the response", async () => {
    const { port, send } = client(REQUEST, 201);

    const saved = await new HttpSmeRequestGateway(port).submit(REQUEST);

    expect(send).toHaveBeenCalledWith({ method: "POST", path: "/sme-requests", body: REQUEST });
    expect(saved).toEqual(REQUEST);
  });

  it("rejects a response that violates the contract", async () => {
    const { port } = client({ ...REQUEST, declaredTotalArs: "9700000" });

    await expect(new HttpSmeRequestGateway(port).submit(REQUEST)).rejects.toThrow();
  });

  it("loads the current request and sales history from GET /sme-requests/current", async () => {
    const { port, send } = client({ request: REQUEST, salesPeriods: [PERIOD] });

    const current = await new HttpSmeRequestGateway(port).loadCurrent();

    expect(send).toHaveBeenCalledWith({ method: "GET", path: "/sme-requests/current" });
    expect(current).toEqual({ request: REQUEST, salesPeriods: [PERIOD] });
  });

  it("rejects malformed sales history", async () => {
    const { port } = client({ request: REQUEST, salesPeriods: [{ ...PERIOD, period: "enero" }] });

    await expect(new HttpSmeRequestGateway(port).loadCurrent()).rejects.toThrow();
  });
});
