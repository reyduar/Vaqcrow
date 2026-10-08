"use client";

import { Modal } from "@heroui/react";
import { useId, useState } from "react";
import type { IconType } from "react-icons";
import {
  IoAlertOutline,
  IoCheckmarkOutline,
  IoInformationCircleOutline,
  IoShieldOutline,
  IoWarningOutline
} from "react-icons/io5";
import {
  CLOSE_ANY_DAYS,
  EMPTY_MARKETPLACE_FILTERS,
  filterMarketplaceCards,
  GOAL_ANY_MILLIONS,
  type MarketplaceFilters
} from "@/application/marketplace/filters";
import type { MarketplaceCard } from "@/application/ports/marketplace-port";
import { Button } from "../button";
import { Slider } from "../slider";

/**
 * The Explorar PyMEs advanced-filter dialog (Feature #414, WU4b), mirroring the
 * template's `#filtros` modal. It edits a **draft** initialized from the applied
 * filters each time it opens: closing by any route (×, Escape, overlay) or
 * "Restablecer" never touches the applied filters, and only "Mostrar N PyMEs"
 * commits through `onApply`. The apply label is the **live** count over the
 * draft, so a user sees the result of a change before committing it. The
 * current search text is part of that count (it is not edited here), which is
 * why it arrives as its own prop.
 */

type RiskBandOption = "low" | "medium" | "high";

const RISK_OPTIONS: readonly { readonly band: RiskBandOption; readonly label: string; readonly icon: IconType }[] = [
  { band: "low", label: "Bajo", icon: IoShieldOutline },
  { band: "medium", label: "Medio", icon: IoAlertOutline },
  { band: "high", label: "Alto", icon: IoWarningOutline }
];

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
/** Stable id so the "Filtros" trigger can `aria-controls` the dialog. */
export const MARKETPLACE_FILTERS_DIALOG_ID = "vq-marketplace-filters";
const HEALTHY_PILL = "border border-control bg-transparent text-text-primary";
const SELECTED_PILL = "border-2 border-brand-accent-text bg-brand-accent-tint font-semibold";

function goalValueLabel(millions: number): string {
  return millions >= GOAL_ANY_MILLIONS ? "Cualquier monto" : `Hasta ARS ${millions} M`;
}

function closeValueLabel(days: number): string {
  return days >= CLOSE_ANY_DAYS ? "Cualquier fecha" : `Próximos ${days} días`;
}

export interface MarketplaceFiltersModalProps {
  readonly isOpen: boolean;
  readonly filters: MarketplaceFilters;
  readonly sectors: readonly string[];
  readonly cities: readonly string[];
  readonly cards: readonly MarketplaceCard[];
  readonly today: Date;
  /** The current search text, included in the live result count. */
  readonly text: string;
  readonly onApply: (filters: MarketplaceFilters) => void;
  readonly onClose: () => void;
}

export function MarketplaceFiltersModal({
  isOpen,
  onClose,
  ...content
}: MarketplaceFiltersModalProps) {
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container size="md">
        <MarketplaceFiltersModalContent onClose={onClose} {...content} />
      </Modal.Container>
    </Modal.Backdrop>
  );
}

type ContentProps = Omit<MarketplaceFiltersModalProps, "isOpen">;

function MarketplaceFiltersModalContent({
  filters,
  sectors,
  cities,
  cards,
  today,
  text,
  onApply,
  onClose
}: ContentProps) {
  // Draft lives here, inside the backdrop, so a close unmounts it and the next
  // opening re-initializes from the applied filters (same pattern as
  // `TransactionReviewModal`).
  const [draft, setDraft] = useState<MarketplaceFilters>(filters);
  const cityListId = useId();

  const draftCount = filterMarketplaceCards(cards, { text, filters: draft }, today).length;
  const applyLabel = draftCount === 1 ? "Mostrar 1 PyME" : draftCount === 0 ? "Sin resultados" : `Mostrar ${draftCount} PyMEs`;

  const toggleRisk = (band: RiskBandOption) =>
    setDraft((current) => ({
      ...current,
      risks: current.risks.includes(band)
        ? current.risks.filter((entry) => entry !== band)
        : [...current.risks, band]
    }));

  const toggleSector = (sector: string) =>
    setDraft((current) => ({
      ...current,
      sectors: current.sectors.includes(sector)
        ? current.sectors.filter((entry) => entry !== sector)
        : [...current.sectors, sector]
    }));

  return (
    <Modal.Dialog id={MARKETPLACE_FILTERS_DIALOG_ID} className="flex flex-col gap-4">
      <Modal.CloseTrigger aria-label="Cerrar filtros" />
      <Modal.Header className="pr-8">
        <Modal.Heading>Filtros avanzados</Modal.Heading>
      </Modal.Header>

      <Modal.Body className="flex flex-col gap-7">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2.5 p-0 text-xs font-semibold tracking-[0.06em] text-text-secondary">
            PERFIL DE RIESGO
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {RISK_OPTIONS.map(({ band, label, icon: Icon }) => {
              const pressed = draft.risks.includes(band);
              return (
                <button
                  key={band}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggleRisk(band)}
                  className={`flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-control text-[15px] text-text-primary ${
                    pressed ? SELECTED_PILL : HEALTHY_PILL
                  } ${FOCUS_RING}`}
                >
                  <Icon aria-hidden="true" focusable="false" className="text-[17px]" />
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2.5 p-0 text-xs font-semibold tracking-[0.06em] text-text-secondary">SECTOR</legend>
          <div className="flex flex-wrap gap-2">
            {sectors.map((sector) => {
              const pressed = draft.sectors.includes(sector);
              return (
                <button
                  key={sector}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggleSector(sector)}
                  className={`flex h-[38px] cursor-pointer items-center gap-1.5 rounded-pill px-3.5 text-sm text-text-primary ${
                    pressed ? SELECTED_PILL : HEALTHY_PILL
                  } ${FOCUS_RING}`}
                >
                  {pressed ? <IoCheckmarkOutline aria-hidden="true" focusable="false" className="text-[15px]" /> : null}
                  {sector}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2.5">
          <span className="text-xs font-semibold tracking-[0.06em] text-text-secondary">LOCALIZACIÓN</span>
          <input
            type="text"
            list={cityListId}
            value={draft.location}
            onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
            placeholder="Ciudad o provincia (ej. Córdoba)"
            className="h-11 w-full rounded-control border border-control bg-canvas px-3.5 text-text-primary outline-none"
          />
          <datalist id={cityListId}>
            {cities.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </label>

        <div className="flex flex-col gap-2">
          <Slider
            label="META DE LA CAMPAÑA"
            minValue={2}
            maxValue={GOAL_ANY_MILLIONS}
            step={1}
            value={draft.goalMaxMillions}
            onChange={(value) => {
              if (typeof value === "number") setDraft((current) => ({ ...current, goalMaxMillions: value }));
            }}
            formatValue={goalValueLabel}
          />
          <div className="flex justify-between text-xs text-text-secondary">
            <span>ARS 2 M</span>
            <span>Cualquier monto</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Slider
            label="CIERRE DE LA CAMPAÑA"
            minValue={30}
            maxValue={CLOSE_ANY_DAYS}
            step={15}
            value={draft.closeMaxDays}
            onChange={(value) => {
              if (typeof value === "number") setDraft((current) => ({ ...current, closeMaxDays: value }));
            }}
            formatValue={closeValueLabel}
          />
          <div className="flex justify-between text-xs text-text-secondary">
            <span>30 días</span>
            <span>Cualquier fecha</span>
          </div>
        </div>

        <p className="m-0 flex gap-2 text-[13px] text-text-secondary">
          <IoInformationCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[17px]" />
          No filtramos por retorno: ninguna campaña promete uno.
        </p>
      </Modal.Body>

      <Modal.Footer className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3">
        <Button variant="secondary" onPress={() => setDraft(EMPTY_MARKETPLACE_FILTERS)}>
          Restablecer
        </Button>
        <Button
          variant="primary"
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        >
          {applyLabel}
        </Button>
      </Modal.Footer>
    </Modal.Dialog>
  );
}
