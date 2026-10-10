import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { MarketplaceCard, MarketplacePort } from "@/application/ports/marketplace-port";
import { PymesEnCampana } from "./pymes-en-campana";

// The cards' CTAs are `next/link`/HeroUI links; no router behaviour is asserted.
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

const GOMERIA = card({
  campaignId: "11111111-1111-4111-8111-111111111111",
  name: "Gomería Los Andes",
  closeDate: "2030-11-14T00:00:00.000Z"
});

const CAFE = card({
  campaignId: "22222222-2222-4222-8222-222222222222",
  name: "Café Tostadero del Paraná",
  closeDate: "2030-11-22T00:00:00.000Z"
});

const REPUESTOS = card({
  campaignId: "33333333-3333-4333-8333-333333333333",
  name: "Repuestos del Oeste SRL",
  closeDate: "2030-12-09T00:00:00.000Z"
});

function okPort(items: readonly MarketplaceCard[]): MarketplacePort {
  return { list: vi.fn().mockResolvedValue({ ok: true, items }) };
}

function renderGrid(port: MarketplacePort) {
  return render(
    <SWRConfig value={SWR_ISOLATED}>
      <PymesEnCampana marketplacePort={port} />
    </SWRConfig>
  );
}

describe("PymesEnCampana (Feature #418, WU2)", () => {
  it("renders the grid ordered by earliest close, excluding the featured campaign", async () => {
    renderGrid(okPort([REPUESTOS, FEATURED, CAFE, GOMERIA]));

    await screen.findByRole("heading", { level: 2, name: "PyMEs en campaña" });
    const gridHeadings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(gridHeadings).toEqual(["Gomería Los Andes", "Café Tostadero del Paraná", "Repuestos del Oeste SRL"]);
    expect(screen.queryByRole("heading", { name: "Fábrica Destacada SRL" })).not.toBeInTheDocument();
  });

  it("shows a neutral landing empty state when no campaign is published", async () => {
    renderGrid(okPort([]));

    expect(await screen.findByText("Todavía no hay campañas publicadas")).toBeInTheDocument();
    expect(screen.getByText("Cuando una PyME publique su campaña, va a aparecer acá.")).toBeInTheDocument();
    // The landing has no filters, so the filter-oriented `/explore` copy must not leak here.
    expect(screen.queryByText("Ninguna campaña coincide")).not.toBeInTheDocument();
  });

  it("shows the marketplace error copy when the list fails, without throwing", async () => {
    renderGrid({ list: vi.fn().mockResolvedValue({ ok: false, code: "unavailable" }) });

    expect(await screen.findByText("No pudimos cargar las campañas")).toBeInTheDocument();
    expect(screen.getByText("El servicio no respondió. Ningún dato ni aporte se modificó.")).toBeInTheDocument();
  });

  it("keeps the loading region while the list is still in flight", () => {
    renderGrid({ list: vi.fn().mockReturnValue(new Promise(() => {})) });

    expect(screen.getByRole("status", { name: "Cargando campañas" })).toBeInTheDocument();
  });
});
