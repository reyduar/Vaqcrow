import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { FavoritePort } from "@/application/ports/favorite-port";
import type { MarketplaceCard, MarketplacePort } from "@/application/ports/marketplace-port";
import { ExploreMarketplace } from "./explore-marketplace";

/**
 * A fresh SWR provider per render keeps each case on its own cache; the module
 * default would otherwise carry a loaded list into a later failing case.
 */
const SWR_ISOLATED = { provider: () => new Map(), dedupingInterval: 0 } as const;

const A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function card(overrides: Partial<MarketplaceCard> = {}): MarketplaceCard {
  return {
    campaignId: "00000000-0000-4000-8000-000000000000",
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    city: "Córdoba",
    goalArs: 15_000_000,
    raisedArs: 9_450_000,
    fundedPercentBps: 6_300,
    revenueShare: 4.5,
    riskBand: "medium",
    riskConfidence: 0.8,
    // Far in the future so the default (open) close filter always includes it.
    closeDate: "2030-11-30T12:00:00.000Z",
    imageSrc: null,
    ...overrides
  };
}

const PANADERIA = card({
  campaignId: A_ID,
  name: "Panadería Horizonte SRL",
  sector: "Alimentos",
  city: "Córdoba",
  goalArs: 15_000_000,
  closeDate: "2030-11-30T12:00:00.000Z",
  riskBand: "medium",
  imageSrc: "https://cdn.example.test/pyme-panaderia.jpg"
});

const CAFE = card({
  campaignId: B_ID,
  name: "Café Tostadero del Paraná",
  sector: "Gastronomía",
  city: "Rosario",
  goalArs: 9_500_000,
  revenueShare: 3.8,
  closeDate: "2030-11-14T12:00:00.000Z",
  riskBand: "low",
  imageSrc: null
});

const GIMNASIO = card({
  campaignId: C_ID,
  name: "Gimnasio Forja",
  sector: "Salud y deporte",
  city: "San Miguel de Tucumán",
  goalArs: 10_000_000,
  revenueShare: 5.5,
  closeDate: "2030-12-20T12:00:00.000Z",
  riskBand: "high",
  imageSrc: "https://cdn.example.test/pyme-gimnasio.jpg"
});

const CARDS: readonly MarketplaceCard[] = [PANADERIA, CAFE, GIMNASIO];

function okPort(items: readonly MarketplaceCard[] = CARDS): MarketplacePort {
  return { list: vi.fn().mockResolvedValue({ ok: true, items }) };
}

function renderExplore(props: {
  readonly signedIn: boolean;
  readonly marketplacePort?: MarketplacePort;
  readonly favoritePort?: FavoritePort;
}) {
  const ui: ReactNode = <ExploreMarketplace {...props} />;
  return render(<SWRConfig value={SWR_ISOLATED}>{ui}</SWRConfig>);
}

function headingOrder(): (string | null)[] {
  return screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
}

describe("ExploreMarketplace", () => {
  it("renders the template title and subtitle with no action slot", async () => {
    renderExplore({ signedIn: false, marketplacePort: okPort() });

    expect(screen.getByRole("heading", { level: 1, name: "Explorar PyMEs" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Campañas de revenue share con riesgo explícito y evidencia verificable. Todos los casos son sintéticos y operan con activos de prueba sin valor económico."
      )
    ).toBeInTheDocument();
    await screen.findByRole("heading", { level: 3, name: "Panadería Horizonte SRL" });
  });

  it("renders one card per campaign with name, meta, SIMULADO, risk text + icon, revenue share, close and CTA", async () => {
    renderExplore({ signedIn: false, marketplacePort: okPort() });

    await screen.findByRole("heading", { level: 3, name: "Panadería Horizonte SRL" });
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByText("Alimentos · Córdoba")).toBeInTheDocument();
    expect(screen.getAllByText("SIMULADO")).toHaveLength(3);
    // Panadería (override) is the only 4,5 % card; Café and Gimnasio carry others.
    expect(screen.getByText("4,5 % de ventas")).toBeInTheDocument();
    // The two campaigns with an image show a "Cierre" details row instead of "Riesgo".
    expect(screen.getAllByText("Cierre")).toHaveLength(2);

    const riskBadge = screen.getByText("Riesgo alto").closest("[data-variant='risk']");
    expect(riskBadge?.querySelector("svg")).not.toBeNull();

    const link = screen.getByRole("link", { name: "Ver evidencia y riesgo de Panadería Horizonte SRL" });
    // Visible text is the template's short label; the PyME name lives in aria-label.
    expect(link).toHaveTextContent("Ver evidencia y riesgo");
    expect(link).toHaveAttribute("href", `/campaigns/${A_ID}`);
  });

  it("announces an accessible loading state while the list is pending", () => {
    const pending: MarketplacePort = { list: () => new Promise<never>(() => {}) };

    renderExplore({ signedIn: false, marketplacePort: pending });

    expect(screen.getByRole("status", { name: "Cargando campañas" })).toBeInTheDocument();
  });

  it("shows the error state and retries through the port", async () => {
    const list = vi.fn().mockResolvedValue({ ok: false, code: "network" });
    const port: MarketplacePort = { list };

    renderExplore({ signedIn: false, marketplacePort: port });

    expect(await screen.findByText("No pudimos cargar las campañas")).toBeInTheDocument();
    expect(screen.getByText("El servicio no respondió. Ningún dato ni aporte se modificó.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("narrows the search, adds a chip, and removes the chip to restore the full list", async () => {
    renderExplore({ signedIn: false, marketplacePort: okPort() });
    await screen.findByRole("heading", { level: 3, name: "Panadería Horizonte SRL" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar PyMEs" }), {
      target: { value: "Café" }
    });

    expect(headingOrder()).toEqual(["Café Tostadero del Paraná"]);
    const chip = screen.getByRole("button", { name: "Quitar búsqueda" });
    expect(chip).toHaveTextContent("“Café”");

    fireEvent.click(chip);
    expect(headingOrder()).toHaveLength(3);
  });

  it("clears everything from the empty state", async () => {
    renderExplore({ signedIn: false, marketplacePort: okPort() });
    await screen.findByRole("heading", { level: 3, name: "Panadería Horizonte SRL" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar PyMEs" }), {
      target: { value: "zzzz" }
    });

    expect(screen.getByText("Ninguna campaña coincide")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros y búsqueda" }));

    expect(screen.getByRole("searchbox", { name: "Buscar PyMEs" })).toHaveValue("");
    expect(headingOrder()).toHaveLength(3);
  });

  it("resets the search from the 'Limpiar filtros' affordance", async () => {
    renderExplore({ signedIn: false, marketplacePort: okPort() });
    await screen.findByRole("heading", { level: 3, name: "Panadería Horizonte SRL" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar PyMEs" }), {
      target: { value: "Café" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(screen.getByRole("searchbox", { name: "Buscar PyMEs" })).toHaveValue("");
    expect(headingOrder()).toHaveLength(3);
  });

  it("reorders the grid through the sort Select", async () => {
    renderExplore({ signedIn: false, marketplacePort: okPort() });
    await screen.findByRole("heading", { level: 3, name: "Panadería Horizonte SRL" });

    // Default sort is "close": Café (14/11) → Panadería (30/11) → Gimnasio (20/12).
    expect(headingOrder()).toEqual([
      "Café Tostadero del Paraná",
      "Panadería Horizonte SRL",
      "Gimnasio Forja"
    ]);

    fireEvent.click(screen.getByRole("button", { name: /Ordenar por/ }));
    fireEvent.click(screen.getByRole("option", { name: "Menor meta" }));

    // "Menor meta": Café (9,5 M) → Gimnasio (10 M) → Panadería (15 M).
    expect(headingOrder()).toEqual([
      "Café Tostadero del Paraná",
      "Gimnasio Forja",
      "Panadería Horizonte SRL"
    ]);
  });

  it("hides the favorite heart for an anonymous visitor", async () => {
    renderExplore({ signedIn: false, marketplacePort: okPort() });
    await screen.findByRole("heading", { level: 3, name: "Panadería Horizonte SRL" });

    expect(screen.queryByRole("button", { name: /favoritos/ })).not.toBeInTheDocument();
  });

  it("shows the heart for a signed-in visitor and adds a favorite through the port", async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, campaignIds: [] });
    const add = vi.fn().mockResolvedValue({ ok: true, applied: true });
    const remove = vi.fn().mockResolvedValue({ ok: true, applied: false });
    const favoritePort: FavoritePort = { list, add, remove };

    renderExplore({ signedIn: true, marketplacePort: okPort(), favoritePort });
    await screen.findByRole("heading", { level: 3, name: "Panadería Horizonte SRL" });

    const heart = await screen.findByRole("button", { name: "Agregar a favoritos: Panadería Horizonte SRL" });
    expect(heart).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(heart);
    await waitFor(() => expect(add).toHaveBeenCalledWith(A_ID));
  });

  it("removes an existing favorite through the port", async () => {
    const list = vi.fn().mockResolvedValue({ ok: true, campaignIds: [A_ID] });
    const add = vi.fn().mockResolvedValue({ ok: true, applied: true });
    const remove = vi.fn().mockResolvedValue({ ok: true, applied: false });
    const favoritePort: FavoritePort = { list, add, remove };

    renderExplore({ signedIn: true, marketplacePort: okPort(), favoritePort });
    await screen.findByRole("heading", { level: 3, name: "Panadería Horizonte SRL" });

    const heart = await screen.findByRole("button", { name: "Quitar de favoritos: Panadería Horizonte SRL" });
    expect(heart).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(heart);
    await waitFor(() => expect(remove).toHaveBeenCalledWith(A_ID));
  });
});
