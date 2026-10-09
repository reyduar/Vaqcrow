import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { ReportSalesByPyme, ReportSalesPort } from "@/application/ports/report-port";
import { useReportSales } from "./use-report-sales";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

function sales(overrides: Partial<ReportSalesByPyme> = {}): ReportSalesByPyme {
  return {
    pymes: [
      {
        name: "Café Tostadero del Paraná",
        sector: "Gastronomía · Rosario",
        imageSrc: null,
        period: "2026-08",
        salesArs: 3_902_100,
        status: "reported"
      }
    ],
    ...overrides
  };
}

describe("useReportSales", () => {
  it("loads the block through its own port with the range", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, sales: sales() });
    const port: ReportSalesPort = { get };

    const { result } = renderHook(() => useReportSales(port, "2026-04", "2026-09", true), { wrapper });

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(get).toHaveBeenCalledWith("2026-04", "2026-09");
    expect(result.current.loadFailed).toBe(false);
  });

  it("fetches nothing with a null port", async () => {
    const { result } = renderHook(() => useReportSales(null, "2026-04", "2026-09", true), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.data).toBeNull();
    expect(result.current.loadFailed).toBe(false);
  });

  it("reports its own failure without fabricating a block", async () => {
    const port: ReportSalesPort = { get: vi.fn().mockResolvedValue({ ok: false, code: "unavailable" }) };
    const { result } = renderHook(() => useReportSales(port, "2026-04", "2026-09", true), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("refetches when the range changes and reloads on demand", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, sales: sales() });
    const { result, rerender } = renderHook(
      ({ from, to }: { from: string; to: string }) => useReportSales({ get }, from, to, true),
      { wrapper, initialProps: { from: "2026-04", to: "2026-09" } }
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    rerender({ from: "2026-08", to: "2026-08" });
    await waitFor(() => expect(get).toHaveBeenCalledWith("2026-08", "2026-08"));

    result.current.reload();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
  });
});
