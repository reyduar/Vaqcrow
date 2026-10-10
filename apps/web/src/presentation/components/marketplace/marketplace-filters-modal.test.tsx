import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_MARKETPLACE_FILTERS,
  marketplaceCities,
  marketplaceSectors,
  type MarketplaceFilters
} from "@/application/marketplace/filters";
import type { MarketplaceCard } from "@/application/ports/marketplace-port";
import { MarketplaceFiltersModal } from "./marketplace-filters-modal";

const TODAY = new Date("2026-10-08T12:00:00.000Z");

function card(overrides: Partial<MarketplaceCard> = {}): MarketplaceCard {
  return {
    campaignId: "00000000-0000-4000-8000-000000000000",
    name: "PyME",
    sector: "Alimentos",
    city: "Córdoba",
    goalArs: 5_000_000,
    raisedArs: 1_000_000,
    fundedPercentBps: 2_000,
    revenueShare: 4,
    riskBand: "medium",
    riskConfidence: 0.5,
    closeDate: "2030-01-01T12:00:00.000Z",
    imageSrc: null,
    ...overrides
  };
}

const CARDS: readonly MarketplaceCard[] = [
  card({
    campaignId: "m1",
    name: "Alta",
    sector: "Alimentos",
    city: "Córdoba",
    riskBand: "high",
    goalArs: 5_000_000,
    closeDate: "2026-11-01T12:00:00.000Z"
  }),
  card({
    campaignId: "m2",
    name: "Baja",
    sector: "Gastronomía",
    city: "Rosario",
    riskBand: "low",
    goalArs: 8_000_000,
    closeDate: "2026-11-15T12:00:00.000Z"
  }),
  card({
    campaignId: "m3",
    name: "Media",
    sector: "Alimentos",
    city: "Mendoza",
    riskBand: "medium",
    goalArs: 12_000_000,
    closeDate: "2026-11-25T12:00:00.000Z"
  })
];

interface ModalProps {
  readonly isOpen?: boolean;
  readonly filters?: MarketplaceFilters;
  readonly text?: string;
  readonly onApply?: (filters: MarketplaceFilters) => void;
  readonly onClose?: () => void;
}

function renderModal({
  isOpen = true,
  filters = EMPTY_MARKETPLACE_FILTERS,
  text = "",
  onApply = vi.fn(),
  onClose = vi.fn()
}: ModalProps = {}) {
  return render(
    <MarketplaceFiltersModal
      isOpen={isOpen}
      filters={filters}
      sectors={marketplaceSectors(CARDS)}
      cities={marketplaceCities(CARDS)}
      cards={CARDS}
      today={TODAY}
      text={text}
      onApply={onApply}
      onClose={onClose}
    />
  );
}

/**
 * A controlled parent so a close-without-apply can be observed as the applied
 * filters staying untouched, and a reopen can be shown to discard the draft.
 */
function Harness() {
  const [isOpen, setIsOpen] = useState(true);
  const [filters, setFilters] = useState<MarketplaceFilters>(EMPTY_MARKETPLACE_FILTERS);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Abrir filtros
      </button>
      <span data-testid="applied-risks">{filters.risks.join(",")}</span>
      <MarketplaceFiltersModal
        isOpen={isOpen}
        filters={filters}
        sectors={marketplaceSectors(CARDS)}
        cities={marketplaceCities(CARDS)}
        cards={CARDS}
        today={TODAY}
        text=""
        onApply={setFilters}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

describe("MarketplaceFiltersModal", () => {
  it("opens with the applied filters as the draft", () => {
    const applied: MarketplaceFilters = {
      risks: ["high"],
      sectors: ["Alimentos"],
      location: "Córdoba",
      goalMaxMillions: 8,
      closeMaxDays: 60
    };

    renderModal({ filters: applied });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Filtros avanzados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Alimentos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("LOCALIZACIÓN")).toHaveValue("Córdoba");
    expect(screen.getByText("Hasta ARS 8 M")).toBeInTheDocument();
    expect(screen.getByText("Próximos 60 días")).toBeInTheDocument();
  });

  it("drives the apply label from the live draft, including the current search text", () => {
    renderModal({ text: "" });
    expect(screen.getByRole("button", { name: "Mostrar 3 PyMEs" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Alto" }));
    expect(screen.getByRole("button", { name: "Mostrar 1 PyME" })).toBeInTheDocument();
  });

  it("commits the draft through onApply and closes", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderModal({ onApply, onClose });

    fireEvent.click(screen.getByRole("button", { name: "Alto" }));
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 1 PyME" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0]?.[0]).toMatchObject({ risks: ["high"] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("discards the draft when closed without applying", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Alto" }));
    expect(screen.getByRole("button", { name: "Alto" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar filtros" }));
    expect(screen.getByTestId("applied-risks")).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button", { name: "Abrir filtros" }));
    expect(screen.getByRole("button", { name: "Alto" })).toHaveAttribute("aria-pressed", "false");
  });

  it("resets the draft from Restablecer", () => {
    renderModal({
      filters: {
        risks: ["high"],
        sectors: ["Alimentos"],
        location: "Córdoba",
        goalMaxMillions: 8,
        closeMaxDays: 60
      }
    });
    expect(screen.getByRole("button", { name: "Mostrar 1 PyME" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restablecer" }));

    expect(screen.getByRole("button", { name: "Alto" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Alimentos" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("LOCALIZACIÓN")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Mostrar 3 PyMEs" })).toBeInTheDocument();
  });

  it("renders the no-return-figure disclosure", () => {
    renderModal();

    expect(screen.getByText("No filtramos por retorno: ninguna campaña promete uno.")).toBeInTheDocument();
  });

  it("shows the goal slider label on either side of the threshold", () => {
    renderModal();

    const thumb = screen.getByRole("slider", { name: "META DE LA CAMPAÑA" });
    thumb.focus();
    fireEvent.keyDown(thumb, { key: "ArrowLeft" });

    expect(screen.getByText("Hasta ARS 15 M")).toBeInTheDocument();
  });

  it("shows the close slider label on either side of the threshold", () => {
    renderModal();

    const thumb = screen.getByRole("slider", { name: "CIERRE DE LA CAMPAÑA" });
    thumb.focus();
    fireEvent.keyDown(thumb, { key: "ArrowLeft" });

    expect(screen.getByText("Próximos 135 días")).toBeInTheDocument();
  });
});
