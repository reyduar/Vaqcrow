import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { MarketplaceCard, MarketplacePort } from "@/application/ports/marketplace-port";
import { FeaturedCampaign } from "./featured-campaign";

// The card's CTA is a `next/link`; no router behaviour is asserted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/"
}));

/** A fresh SWR cache per render keeps each case off the module default. */
const SWR_ISOLATED = { provider: () => new Map(), dedupingInterval: 0 } as const;

function card(overrides: Partial<MarketplaceCard> & Pick<MarketplaceCard, "campaignId">): MarketplaceCard {
  return {
    name: "PyME de prueba",
    sector: "Sector",
    city: "Ciudad",
    goalArs: 10_000_000,
    raisedArs: null,
    fundedPercentBps: 0,
    revenueShare: 4,
    riskBand: null,
    riskConfidence: null,
    closeDate: "2030-01-01T00:00:00.000Z",
    imageSrc: null,
    ...overrides
  };
}

const FEATURED = card({
  campaignId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  name: "Fábrica Destacada SRL",
  sector: "Manufactura",
  city: "Córdoba",
  fundedPercentBps: 9_000,
  imageSrc: "https://cdn.example.test/pyme-fabrica.jpg",
  closeDate: "2030-12-01T00:00:00.000Z"
});

const LOWER = card({
  campaignId: "11111111-1111-4111-8111-111111111111",
  name: "Gomería Los Andes",
  fundedPercentBps: 1_000,
  closeDate: "2030-11-14T00:00:00.000Z"
});

function okPort(items: readonly MarketplaceCard[]): MarketplacePort {
  return { list: vi.fn().mockResolvedValue({ ok: true, items }) };
}

function renderFeatured(port: MarketplacePort) {
  return render(
    <SWRConfig value={SWR_ISOLATED}>
      <FeaturedCampaign marketplacePort={port} />
    </SWRConfig>
  );
}

describe("FeaturedCampaign (Feature #418, WU2)", () => {
  it("features the campaign with the most funding", async () => {
    renderFeatured(okPort([LOWER, FEATURED]));

    expect(await screen.findByRole("heading", { level: 2, name: "Fábrica Destacada SRL" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Gomería Los Andes" })).not.toBeInTheDocument();
  });

  it("falls back to the template's simulated example when there is no campaign", async () => {
    renderFeatured(okPort([]));

    expect(await screen.findByRole("heading", { level: 2, name: "Panadería Horizonte SRL" })).toBeInTheDocument();
    expect(screen.getByText("Panificación · Córdoba · desde 2016")).toBeInTheDocument();
    expect(screen.getByText("Imagen representativa")).toBeInTheDocument();
    expect(screen.getAllByText("SIMULADO").length).toBeGreaterThan(0);
  });

  it("keeps the simulated example on a failed read rather than leaving the slot empty", async () => {
    renderFeatured({ list: vi.fn().mockResolvedValue({ ok: false, code: "unavailable" }) });

    expect(await screen.findByRole("heading", { level: 2, name: "Panadería Horizonte SRL" })).toBeInTheDocument();
  });

  it("shows the loading region while the list is still in flight", () => {
    renderFeatured({ list: vi.fn().mockReturnValue(new Promise(() => {})) });

    expect(screen.getByText("Cargando campaña destacada")).toBeInTheDocument();
  });
});
