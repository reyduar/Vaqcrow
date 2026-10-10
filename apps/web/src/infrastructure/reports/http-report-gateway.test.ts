import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";
import { HttpReportGateway } from "./http-report-gateway";

const BASE = "http://localhost:3000";

const WIRE = {
  range: { from: "2026-04", to: "2026-09" },
  availableRange: { firstPeriod: "2026-04", lastPeriod: "2026-09" },
  isEmpty: false,
  kpis: {
    contributedXlm: "850.0000000",
    confirmedDistributionsXlm: "17.3750000",
    pendingDistributionsCount: 1,
    pendingDistributionsXlm: "4.0850000",
    campaignsCount: 3
  },
  monthlySeries: [
    { period: "2026-04", amountXlm: null, state: "none" },
    { period: "2026-09", amountXlm: "4.0850000", state: "pending" }
  ],
  latestDistributions: [
    {
      date: "2026-09-26T12:00:00.000Z",
      pyme: "Café Tostadero del Paraná",
      declaredSalesArs: null,
      shareXlm: "4.0850000",
      state: "submitted",
      transactionHash: "a".repeat(64),
      explorerUrl: null
    }
  ],
  contributionTransactions: []
};

type Result = { status: number; data: unknown } | Error;

function fakeClient(result: Result) {
  const calls: { url: string; params: unknown; headers: Record<string, string> | undefined }[] = [];
  const client = {
    get: async (url: string, config?: { params?: unknown; headers?: Record<string, string> }) => {
      calls.push({ url, params: config?.params, headers: config?.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

const token: AccessTokenProvider = async () => "header.payload.signature";

describe("HttpReportGateway.get", () => {
  it("reads the report for the range with the bearer header", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE });
    const gateway = new HttpReportGateway(client, token);

    const result = await gateway.get("2026-04", "2026-09");

    expect(calls[0]!.url).toBe("/reports");
    expect(calls[0]!.params).toEqual({ from: "2026-04", to: "2026-09" });
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer header.payload.signature" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.availableRange).toEqual({ firstPeriod: "2026-04", lastPeriod: "2026-09" });
    expect(result.report.monthlySeries[0]!.state).toBe("none");
    expect(result.report.kpis.pendingDistributionsXlm).toBe("4.0850000");
  });

  it("omits the query when no range is supplied", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE });
    const gateway = new HttpReportGateway(client, token);

    await gateway.get(null, null);

    expect(calls[0]!.url).toBe("/reports");
    expect(calls[0]!.params).toEqual({});
  });

  it("maps 401 and 403 to unauthenticated", async () => {
    const unauthorized = new HttpReportGateway(fakeClient({ status: 401, data: { code: "unauthenticated" } }).client, token);
    const forbidden = new HttpReportGateway(fakeClient({ status: 403, data: { code: "forbidden" } }).client, token);

    expect(await unauthorized.get(null, null)).toEqual({ ok: false, code: "unauthenticated" });
    expect(await forbidden.get(null, null)).toEqual({ ok: false, code: "unauthenticated" });
  });

  it("maps a 503 unavailable envelope to unavailable", async () => {
    const gateway = new HttpReportGateway(fakeClient({ status: 503, data: { code: "unavailable" } }).client, token);
    expect(await gateway.get(null, null)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const gateway = new HttpReportGateway(fakeClient(new Error("boom")).client, token);
    expect(await gateway.get(null, null)).toEqual({ ok: false, code: "network" });
  });

  it("passes the distribution hash and the range's contribution transactions through (#438/WU5)", async () => {
    const TX_HASH = "b".repeat(64);
    const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";
    const transaction = {
      date: "2026-09-02T10:05:00.000Z",
      pyme: "Café Tostadero del Paraná",
      amountXlm: "100.0000000",
      transactionHash: TX_HASH,
      explorerUrl: `https://explorer.example/tx/${TX_HASH}`,
      vaultAddress: VAULT,
      vaultExplorerUrl: null
    };
    const { client } = fakeClient({ status: 200, data: { ...WIRE, contributionTransactions: [transaction] } });
    const gateway = new HttpReportGateway(client, token);

    const result = await gateway.get("2026-04", "2026-09");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.contributionTransactions).toEqual([transaction]);
    expect(result.report.latestDistributions[0]!.transactionHash).toBe("a".repeat(64));
  });

  it("rejects a malformed body instead of rendering it", async () => {
    const gateway = new HttpReportGateway(
      fakeClient({ status: 200, data: { ...WIRE, kpis: { ...WIRE.kpis, contributedXlm: "850" } } }).client,
      token
    );
    expect(await gateway.get(null, null)).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("HttpReportGateway.create", () => {
  it("builds a gateway whose get is callable", () => {
    const gateway = HttpReportGateway.create(BASE);
    expect(typeof gateway.get).toBe("function");
  });
});
