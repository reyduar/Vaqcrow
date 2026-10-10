import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { InvestorReport, ReportPort } from "@/application/ports/report-port";
import { useInvestorReport } from "./use-investor-report";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

function report(overrides: Partial<InvestorReport> = {}): InvestorReport {
  return {
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
    monthlySeries: [],
    latestDistributions: [],
    contributionTransactions: [],
    ...overrides
  };
}

describe("useInvestorReport", () => {
  it("fetches nothing with a null port", async () => {
    const { result } = renderHook(() => useInvestorReport(null, "2026-04", "2026-09", true), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.data).toBeNull();
    expect(result.current.loadFailed).toBe(false);
  });

  it("fetches nothing while disabled", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, report: report() });
    const { result } = renderHook(() => useInvestorReport({ get }, "2026-04", "2026-09", false), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(get).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("loads the report through the port with the range", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, report: report() });
    const port: ReportPort = { get };

    const { result } = renderHook(() => useInvestorReport(port, "2026-04", "2026-09", true), { wrapper });

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(get).toHaveBeenCalledWith("2026-04", "2026-09");
    expect(result.current.loadFailed).toBe(false);
  });

  it("asks for the API default when the range is null", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, report: report() });
    const { result } = renderHook(() => useInvestorReport({ get }, null, null, true), { wrapper });

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(get).toHaveBeenCalledWith(null, null);
  });

  it("refetches when the range changes", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, report: report() });
    const { result, rerender } = renderHook(
      ({ from, to }: { from: string; to: string }) => useInvestorReport({ get }, from, to, true),
      { wrapper, initialProps: { from: "2026-04", to: "2026-09" } }
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    rerender({ from: "2026-07", to: "2026-09" });

    await waitFor(() => expect(get).toHaveBeenCalledWith("2026-07", "2026-09"));
  });

  it("reports a failure without fabricating a report", async () => {
    const port: ReportPort = { get: vi.fn().mockResolvedValue({ ok: false, code: "network" }) };
    const { result } = renderHook(() => useInvestorReport(port, "2026-04", "2026-09", true), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("reloads through the port", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, report: report() });
    const { result } = renderHook(() => useInvestorReport({ get }, "2026-04", "2026-09", true), { wrapper });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    result.current.reload();

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
