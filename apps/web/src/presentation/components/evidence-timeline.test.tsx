import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceEntry } from "@/application/evidence/evidence-timeline";
import { microcopy } from "@/application/trust/disclosures";
import { EvidenceTimeline } from "./evidence-timeline";

const EXPLORER = "https://stellar.expert/explorer/testnet/tx/TRANSACTION-HASH";

function observedEntry(overrides: Partial<EvidenceEntry> = {}): EvidenceEntry {
  return {
    id: "revenue-share-distribution",
    title: "Distribución de ingresos",
    state: "observed",
    description: "Distribución de ingresos registrada en Stellar Testnet.",
    badges: [
      { variant: "testnet", label: microcopy.testnetBadge },
      { variant: "transaction", label: "Transacción de la distribución" }
    ],
    facts: [
      { label: "Estado", value: "Enviada · pendiente de confirmación" },
      { label: "Destinatarios", value: "1" }
    ],
    hashes: [
      { label: "Hash de transacción", value: "TRANSACTION-HASH", explorerUrl: EXPLORER }
    ],
    calculation: {
      heading: "Cálculo de distribución",
      ruleId: "RS-2026-01 · SIMULADO",
      inputs: [{ label: "Destinatario 1", value: "1.35 XLM" }],
      rounding: "Hacia abajo (piso), en unidades mínimas",
      total: { label: "Total distribuido", value: "1.35 XLM" }
    },
    ...overrides
  };
}

function absentEntry(): EvidenceEntry {
  return {
    id: "human-decision",
    title: "Decisión humana",
    state: "absent",
    description: "No hay una decisión humana registrada para esta solicitud.",
    badges: [],
    facts: [],
    hashes: []
  };
}

function unavailableEntry(): EvidenceEntry {
  return {
    id: "campaign-vault",
    title: "Bóveda de campaña",
    state: "unavailable",
    description: "No se pudo leer la bóveda de campaña en esta sesión.",
    badges: [],
    facts: [],
    hashes: []
  };
}

describe("EvidenceTimeline", () => {
  it("renders an ordered, accessibly named timeline of every entry", () => {
    render(<EvidenceTimeline entries={[observedEntry(), absentEntry(), unavailableEntry()]} />);

    const region = screen.getByRole("region", { name: "Evidencia de la ejecución" });
    expect(region.querySelector("ol")).not.toBeNull();
    expect(region.querySelectorAll("ol > li")).toHaveLength(3);
  });

  it("renders the observed entry's facts, hash, explorer link and calculation", () => {
    render(<EvidenceTimeline entries={[observedEntry()]} />);

    expect(screen.getByText("Distribución de ingresos")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("Enviada · pendiente de confirmación")).toBeInTheDocument();

    expect(screen.getByText("TRANSACTION-HASH")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Ver en el explorador/i });
    expect(link).toHaveAttribute("href", EXPLORER);

    expect(screen.getByText("Cálculo de distribución")).toBeInTheDocument();
    expect(screen.getByText("RS-2026-01 · SIMULADO")).toBeInTheDocument();
    expect(screen.getByText("Total distribuido")).toBeInTheDocument();

    // The hash note that belongs beside any hash travels with the timeline. The
    // prior-run-hash note does not: a hash read back from the API cannot say whether
    // it came from this run, so the recap must not label the live hash as an old one.
    expect(screen.getByText(microcopy.hashTechnicalOnly)).toBeInTheDocument();
    expect(screen.queryByText(microcopy.priorRunHash)).not.toBeInTheDocument();
  });

  it("shows absent and unavailable as their own distinct visible words, never colour alone", () => {
    const { container } = render(
      <EvidenceTimeline entries={[absentEntry(), unavailableEntry()]} />
    );

    expect(screen.getByText("Ausente")).toBeInTheDocument();
    expect(screen.getByText("No disponible")).toBeInTheDocument();
    expect(
      screen.getByText("No hay una decisión humana registrada para esta solicitud.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No se pudo leer la bóveda de campaña en esta sesión.")
    ).toBeInTheDocument();

    // The distinction is structural, not only textual.
    expect(container.querySelector('[data-state="absent"]')).not.toBeNull();
    expect(container.querySelector('[data-state="unavailable"]')).not.toBeNull();
  });

  it("never renders a success signal: a pending movement stays pending and a failed one stays failed", () => {
    const failed = observedEntry({
      id: "campaign-vault",
      facts: [
        { label: "Estado", value: "Fallida" },
        { label: "Motivo del fallo", value: "El saldo de la cuenta no alcanza a cubrir el monto." }
      ]
    });
    const { container } = render(<EvidenceTimeline entries={[observedEntry(), failed]} />);

    expect(screen.getAllByText("Enviada · pendiente de confirmación").length).toBeGreaterThan(0);
    expect(screen.getByText("Fallida")).toBeInTheDocument();
    // "Confirmada" is a claim only a confirmed ledger state may make; nothing
    // here confirmed a movement, and no success-toned badge variant exists.
    expect(screen.queryByText(/Confirmada en el ledger/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-variant="success"]')).toHaveLength(0);
  });
});
