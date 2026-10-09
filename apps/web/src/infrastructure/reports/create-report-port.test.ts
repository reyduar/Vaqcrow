import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserReportPort,
  createBrowserReportSalesPort,
  createReportPort,
  createReportSalesPort,
  UNAVAILABLE_REPORT_PORT,
  UNAVAILABLE_REPORT_SALES_PORT
} from "./create-report-port";
import { HttpReportGateway } from "./http-report-gateway";
import { HttpReportSalesGateway } from "./http-report-sales-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createReportPort", () => {
  it("returns null without a base URL", () => {
    expect(createReportPort(undefined)).toBeNull();
    expect(createReportPort("")).toBeNull();
    expect(createReportPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway from a trimmed base URL", () => {
    expect(createReportPort("  http://localhost:3000  ")).toBeInstanceOf(HttpReportGateway);
  });
});

describe("createReportSalesPort", () => {
  it("returns null without a base URL and a gateway otherwise", () => {
    expect(createReportSalesPort(undefined)).toBeNull();
    expect(createReportSalesPort("http://localhost:3000")).toBeInstanceOf(HttpReportSalesGateway);
  });
});

describe("createBrowserReportPort", () => {
  it("falls back to the null object without a configured base URL", () => {
    expect(createBrowserReportPort()).toBe(UNAVAILABLE_REPORT_PORT);
    expect(createBrowserReportSalesPort()).toBe(UNAVAILABLE_REPORT_SALES_PORT);
  });

  it("builds gateways when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    expect(createBrowserReportPort()).toBeInstanceOf(HttpReportGateway);
    expect(createBrowserReportSalesPort()).toBeInstanceOf(HttpReportSalesGateway);
  });
});

describe("unavailable report ports", () => {
  it("answer the sanitized unavailable without touching the network", async () => {
    expect(await UNAVAILABLE_REPORT_PORT.get(null, null)).toEqual({ ok: false, code: "unavailable" });
    expect(await UNAVAILABLE_REPORT_SALES_PORT.get(null, null)).toEqual({ ok: false, code: "unavailable" });
  });
});
