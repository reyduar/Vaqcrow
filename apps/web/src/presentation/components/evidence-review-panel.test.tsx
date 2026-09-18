import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EvidenceReviewItem } from "@/application/evidence/review-view-model";
import { EvidenceReviewPanel } from "./evidence-review-panel";

const SIMULADO = "SIMULADO";

const ITEMS: readonly EvidenceReviewItem[] = [
  {
    kind: "missing",
    periodLabel: "Abril 2026",
    evidence: { status: "unresolved", ref: "ev-abril-2026" }
  },
  {
    kind: "anomalous",
    periodLabel: "Junio 2026",
    evidence: { status: "resolved", ref: "ev-junio-2026", provenance: "Registro sintético de ventas" }
  },
  { kind: "contradictory", declaredTotal: "$ 1.200.000", reportedTotal: "$ 1.050.000" }
];

function renderPanel(findings: readonly EvidenceReviewItem[] = ITEMS) {
  return render(<EvidenceReviewPanel findings={findings} simuladoLabel={SIMULADO} />);
}

describe("EvidenceReviewPanel", () => {
  it("renders one labeled item per finding inside a live region", () => {
    renderPanel();

    expect(screen.getByRole("region", { name: /Revisión de evidencia/ })).toHaveAttribute(
      "aria-live",
      "polite"
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Dato faltante", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Requiere revisión", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Total declarado no coincide", { selector: "strong" })).toBeInTheDocument();
  });

  it("keeps a missing period as 'Dato faltante' and never fills a value", () => {
    renderPanel();

    const item = screen.getByRole("listitem", { name: /Abril 2026/ });

    expect(within(item).getAllByText(/Dato faltante/).length).toBeGreaterThan(0);
    expect(item.textContent).not.toMatch(/\$\s?\d/);
  });

  it("shows an unresolved evidence ref as unresolved without inventing provenance", () => {
    renderPanel();

    const item = screen.getByRole("listitem", { name: /Abril 2026/ });

    expect(within(item).getByText(/ev-abril-2026/)).toBeInTheDocument();
    expect(within(item).getByText(/Evidencia sin resolver/)).toBeInTheDocument();
    expect(within(item).queryByText(/Procedencia/)).not.toBeInTheDocument();
  });

  it("shows resolved evidence with its provenance", () => {
    renderPanel();

    const item = screen.getByRole("listitem", { name: /Junio 2026/ });

    expect(within(item).getByText(/ev-junio-2026/)).toBeInTheDocument();
    expect(within(item).getByText(/Registro sintético de ventas/)).toBeInTheDocument();
    expect(within(item).queryByText(/sin resolver/)).not.toBeInTheDocument();
  });

  it("shows declared total and reported sum for a contradictory finding, each labeled SIMULADO", () => {
    renderPanel();

    const item = screen.getByRole("listitem", { name: /Total declarado no coincide/ });

    expect(within(item).getByText(/Total declarado:/)).toBeInTheDocument();
    expect(within(item).getByText("$ 1.200.000")).toBeInTheDocument();
    expect(within(item).getByText(/Suma de ventas informadas:/)).toBeInTheDocument();
    expect(within(item).getByText("$ 1.050.000")).toBeInTheDocument();
    expect(within(item).getAllByText(SIMULADO)).toHaveLength(2);
  });

  it("makes no causal claim for an anomaly", () => {
    const { container } = renderPanel();

    expect(container.textContent?.toLowerCase()).not.toMatch(
      /porque|debido a|causad[ao] por|a raíz de|se debe a/
    );
  });

  it("renders an explicit empty state when there are no findings", () => {
    renderPanel([]);

    expect(screen.getByText(/Sin hallazgos para revisar/)).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("never renders prohibited phrases", () => {
    const { container } = renderPanel();
    const text = container.textContent ?? "";

    for (const phrase of [
      "Inversión segura",
      "rentabilidad garantizada",
      "Aprobado por IA",
      "Dinero depositado",
      "KYC verificado",
      "Pago real"
    ]) {
      expect(text).not.toContain(phrase);
    }
  });

  it("falls back to 'Dato faltante' for contradictory totals that were not supplied", () => {
    renderPanel([{ kind: "contradictory" }]);

    const item = screen.getByRole("listitem");
    expect(within(item).getAllByText("Dato faltante")).toHaveLength(2);
    expect(within(item).queryAllByText(SIMULADO)).toHaveLength(0);
  });
});
