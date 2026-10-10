import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { CampaignDetail, CampaignDetailPort } from "@/application/ports/campaign-detail-port";
import { useCampaignDetail } from "./use-campaign-detail";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

function detail(overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    campaignId: CAMPAIGN_ID,
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    city: "Rosario",
    description: "Panificados artesanales.",
    foundedAt: "2021-05-01T00:00:00.000Z",
    goalArs: 9_450_000,
    raisedArs: 5_954_000,
    fundedPercentBps: 6_300,
    revenueShare: 4.5,
    riskBand: "low",
    riskConfidence: 0.8,
    closeDate: "2026-11-30T12:00:00.000Z",
    imageSrc: null,
    status: "funding",
    backers: 12,
    vaultAddress: null,
    vaultExplorerUrl: null,
    assessment: null,
    decision: null,
    ...overrides
  };
}

describe("useCampaignDetail", () => {
  it("fetches nothing while disabled", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, detail: detail() });
    const port: CampaignDetailPort = { get };

    const { result } = renderHook(() => useCampaignDetail(CAMPAIGN_ID, port, false), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(get).not.toHaveBeenCalled();
    expect(result.current.detail).toBeNull();
    expect(result.current.loadFailed).toBe(false);
  });

  it("fetches nothing with a null port", async () => {
    const { result } = renderHook(() => useCampaignDetail(CAMPAIGN_ID, null, true), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.detail).toBeNull();
    expect(result.current.loadFailed).toBe(false);
  });

  it("loads the detail through the port", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, detail: detail() });
    const port: CampaignDetailPort = { get };

    const { result } = renderHook(() => useCampaignDetail(CAMPAIGN_ID, port, true), { wrapper });

    await waitFor(() => expect(result.current.detail).not.toBeNull());
    expect(get).toHaveBeenCalledWith(CAMPAIGN_ID);
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.notFound).toBe(false);
    expect(result.current.detail?.name).toBe("Panadería Horizonte SRL");
  });

  it("reports a failure without fabricating a detail", async () => {
    const port: CampaignDetailPort = { get: vi.fn().mockResolvedValue({ ok: false, code: "network" }) };

    const { result } = renderHook(() => useCampaignDetail(CAMPAIGN_ID, port, true), { wrapper });

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.detail).toBeNull();
    expect(result.current.notFound).toBe(false);
  });

  it("keeps a 404 apart from a load failure", async () => {
    const port: CampaignDetailPort = { get: vi.fn().mockResolvedValue({ ok: false, code: "not_found" }) };

    const { result } = renderHook(() => useCampaignDetail(CAMPAIGN_ID, port, true), { wrapper });

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.detail).toBeNull();
  });

  it("reloads through the port", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, detail: detail() });
    const port: CampaignDetailPort = { get };

    const { result } = renderHook(() => useCampaignDetail(CAMPAIGN_ID, port, true), { wrapper });
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    result.current.reload();

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});
