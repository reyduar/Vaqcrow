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

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

describe("HttpSmeRequestGateway", () => {
  it("POSTs the request to /sme-requests and parses the { applicationId, request } response", async () => {
    const { port, send } = client({ applicationId: APPLICATION_ID, request: REQUEST }, 201);

    const saved = await new HttpSmeRequestGateway(port).submit(REQUEST);

    expect(send).toHaveBeenCalledWith({ method: "POST", path: "/sme-requests", body: REQUEST });
    expect(saved).toEqual({ applicationId: APPLICATION_ID, request: REQUEST });
  });

  it("rejects a bare request response (old contract) and a non-uuid applicationId", async () => {
    await expect(new HttpSmeRequestGateway(client(REQUEST, 201).port).submit(REQUEST)).rejects.toThrow();
    await expect(
      new HttpSmeRequestGateway(client({ applicationId: "not-a-uuid", request: REQUEST }, 201).port).submit(REQUEST)
    ).rejects.toThrow();
  });

  it("rejects a response that violates the contract", async () => {
    const { port } = client({ applicationId: APPLICATION_ID, request: { ...REQUEST, declaredTotalArs: "9700000" } });

    await expect(new HttpSmeRequestGateway(port).submit(REQUEST)).rejects.toThrow();
  });

  it("loads the request and sales history from GET /sme-requests/:applicationId", async () => {
    const { port, send } = client({ request: REQUEST, salesPeriods: [PERIOD] });

    const read = await new HttpSmeRequestGateway(port).load(APPLICATION_ID);

    expect(send).toHaveBeenCalledWith({ method: "GET", path: `/sme-requests/${APPLICATION_ID}` });
    expect(read).toEqual({ request: REQUEST, salesPeriods: [PERIOD] });
  });

  it("rejects malformed sales history and a null request", async () => {
    const bad = client({ request: REQUEST, salesPeriods: [{ ...PERIOD, period: "enero" }] });
    await expect(new HttpSmeRequestGateway(bad.port).load(APPLICATION_ID)).rejects.toThrow();
    const nullRequest = client({ request: null, salesPeriods: [] });
    await expect(new HttpSmeRequestGateway(nullRequest.port).load(APPLICATION_ID)).rejects.toThrow();
  });
});
