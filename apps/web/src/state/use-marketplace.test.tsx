import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { MarketplaceCard, MarketplacePort } from "@/application/ports/marketplace-port";
import { useMarketplace } from "./use-marketplace";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

function card(overrides: Partial<MarketplaceCard> = {}): MarketplaceCard {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    city: "Rosario",
    goalArs: 9_450_000,
    raisedArs: 5_954_000,
    fundedPercentBps: 6_300,
    revenueShare: 4.5,
    riskBand: "low",
    riskConfidence: 0.8,
    closeDate: "2026-11-30T12:00:00.000Z",
    imageSrc: null,
    ...overrides
  };
}

describe("useMarketplace", () => {
  it("fetches nothing with a null port", async () => {
    const { result } = renderHook(() => useMarketplace(null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.items).toEqual([]);
    expect(result.current.loadFailed).toBe(false);
  });

  it("loads the campaigns through the port", async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, items: [card()] });
    const port: MarketplacePort = { list };

    const { result } = renderHook(() => useMarketplace(port), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(list).toHaveBeenCalledTimes(1);
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.items[0]!.name).toBe("Panadería Horizonte SRL");
  });

  it("reports a failure without fabricating data", async () => {
    const port: MarketplacePort = { list: vi.fn().mockResolvedValue({ ok: false, code: "network" }) };

    const { result } = renderHook(() => useMarketplace(port), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.items).toEqual([]);
  });

  it("reloads through the port", async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, items: [card()] });
    const port: MarketplacePort = { list };

    const { result } = renderHook(() => useMarketplace(port), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    result.current.reload();

    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});
