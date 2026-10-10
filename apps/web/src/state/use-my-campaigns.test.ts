import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { MyCampaigns, MyCampaignsPort } from "@/application/ports/my-campaigns-port";
import { useMyCampaigns } from "./use-my-campaigns";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

function myCampaigns(overrides: Partial<MyCampaigns> = {}): MyCampaigns {
  return {
    campaigns: [
      {
        campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
        name: "Campaña 2026 · Panadería Horizonte",
        sector: "Alimentos",
        city: "Córdoba",
        imageSrc: null,
        vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
        vaultExplorerUrl: null,
        state: "funding",
        goalArs: 15_000_000,
        raisedArs: 9_450_000,
        fundedPercentBps: 6_300,
        deadline: "2026-11-30T12:00:00.000Z",
        contributorsCount: 38,
        distributions: [],
        sales: []
      }
    ],
    ...overrides
  };
}

describe("useMyCampaigns", () => {
  it("fetches nothing with a null port", async () => {
    const { result } = renderHook(() => useMyCampaigns(null, true), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.data).toBeNull();
    expect(result.current.loadFailed).toBe(false);
  });

  it("fetches nothing while disabled", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, myCampaigns: myCampaigns() });
    const port: MyCampaignsPort = { get };

    const { result } = renderHook(() => useMyCampaigns(port, false), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(get).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("loads the campaign list through the port", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, myCampaigns: myCampaigns() });
    const port: MyCampaignsPort = { get };

    const { result } = renderHook(() => useMyCampaigns(port, true), { wrapper });

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(get).toHaveBeenCalledTimes(1);
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.data?.campaigns[0]?.name).toBe("Campaña 2026 · Panadería Horizonte");
  });

  it("reports a failure without fabricating data", async () => {
    const port: MyCampaignsPort = { get: vi.fn().mockResolvedValue({ ok: false, code: "network" }) };

    const { result } = renderHook(() => useMyCampaigns(port, true), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("reloads through the port", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, myCampaigns: myCampaigns() });
    const port: MyCampaignsPort = { get };

    const { result } = renderHook(() => useMyCampaigns(port, true), { wrapper });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    result.current.reload();

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
