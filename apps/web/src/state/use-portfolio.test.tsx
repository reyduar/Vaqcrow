import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { PortfolioPort, PortfolioSummary } from "@/application/ports/portfolio-port";
import { usePortfolio } from "./use-portfolio";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

function summary(overrides: Partial<PortfolioSummary> = {}): PortfolioSummary {
  return {
    contributions: [
      {
        campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
        name: "Panadería Horizonte SRL",
        sector: "Alimentos",
        city: "Córdoba",
        imageSrc: null,
        contributionXlm: "250.0000000",
        raisedArs: 9_450_000,
        goalArs: 15_000_000,
        fundedPercentBps: 6_300,
        status: "funding",
        closeDate: "2026-11-30T12:00:00.000Z",
        vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2"
      }
    ],
    distributions: [],
    totals: { totalContributedXlm: "250.0000000", totalDistributionsXlm: null, campaignCount: 1 },
    ...overrides
  };
}

describe("usePortfolio", () => {
  it("fetches nothing with a null port", async () => {
    const { result } = renderHook(() => usePortfolio(null, true), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.summary).toBeNull();
    expect(result.current.loadFailed).toBe(false);
  });

  it("fetches nothing while disabled", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, summary: summary() });
    const port: PortfolioPort = { get };

    const { result } = renderHook(() => usePortfolio(port, false), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(get).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();
  });

  it("loads the summary through the port", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, summary: summary() });
    const port: PortfolioPort = { get };

    const { result } = renderHook(() => usePortfolio(port, true), { wrapper });

    await waitFor(() => expect(result.current.summary).not.toBeNull());
    expect(get).toHaveBeenCalledTimes(1);
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.summary?.contributions[0]?.name).toBe("Panadería Horizonte SRL");
  });

  it("reports a failure without fabricating a summary", async () => {
    const port: PortfolioPort = { get: vi.fn().mockResolvedValue({ ok: false, code: "network" }) };

    const { result } = renderHook(() => usePortfolio(port, true), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.summary).toBeNull();
  });

  it("reloads through the port", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, summary: summary() });
    const port: PortfolioPort = { get };

    const { result } = renderHook(() => usePortfolio(port, true), { wrapper });
    await waitFor(() => expect(result.current.summary).not.toBeNull());

    result.current.reload();

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
