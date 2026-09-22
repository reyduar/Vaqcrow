import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiAssessmentPanel } from "./ai-assessment-panel";
import type { AssessmentView } from "@/application/assessment/assessment-view";

/**
 * The panel now renders a real assessment. The fixture it used before belonged
 * to the era when no path existed; what it shows now is what the backend
 * returned, including the provenance that says which model produced it.
 */

const REAL_ASSESSMENT: AssessmentView = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [
    {
      claim: "Abril 2026 no tiene ventas declaradas.",
      evidenceRefs: ["missing:2026-04"]
    },
    {
      claim: "Junio 2026 se aparta de la tendencia de los meses vecinos.",
      evidenceRefs: ["sales:2026-06"]
    }
  ],
  anomalies: [{ type: "outlier", evidenceRef: "sales:2026-06", severity: "review" }],
  missingData: ["Declaración del período 2026-04"],
  recommendedAction: "human_review",
  questions: ["¿Qué explica el incremento de junio?"],
  provenance: {
    model: "glm-5.3-flash",
    promptVersion: "assessment-v1",
    generatedAt: "2026-09-22T12:00:00.000Z",
    source: "provider"
  }
};

describe("AiAssessmentPanel", () => {
  it("names the model that produced the assessment and never claims it is live", () => {
    render(<AiAssessmentPanel assessment={REAL_ASSESSMENT} />);

    expect(screen.getByText("glm-5.3-flash")).toBeInTheDocument();
    expect(screen.queryByText("SIMULADO")).not.toBeInTheDocument();
    expect(screen.getByText(/solo asesora/i)).toBeInTheDocument();
    // The prompt version appears in both the advisory copy and the provenance
    // line, so count rather than get.
    expect(screen.getAllByText(/assessment-v1/).length).toBeGreaterThan(0);
  });

  it("keeps a simulated assessment labelled as simulated", () => {
    render(
      <AiAssessmentPanel
        assessment={{
          ...REAL_ASSESSMENT,
          provenance: { ...REAL_ASSESSMENT.provenance, source: "simulated" }
        }}
      />
    );

    expect(screen.getAllByText("SIMULADO").length).toBeGreaterThan(0);
    expect(screen.getByText(/no corresponde a una llamada en vivo/i)).toBeInTheDocument();
  });

  it("shows risk band and confidence as separate labelled values", () => {
    render(<AiAssessmentPanel assessment={REAL_ASSESSMENT} />);

    expect(screen.getByText("Riesgo medio")).toBeInTheDocument();
    expect(screen.getByText("72 %")).toBeInTheDocument();
    expect(screen.getByText("Revisión humana")).toBeInTheDocument();
  });

  it("lists every reason with its cited evidence references", () => {
    render(<AiAssessmentPanel assessment={REAL_ASSESSMENT} />);

    const reasons = screen.getByRole("list", { name: "Razones" });
    const items = within(reasons).getAllByRole("listitem");

    expect(items).toHaveLength(REAL_ASSESSMENT.reasons.length);
    expect(within(reasons).getByText("missing:2026-04")).toBeInTheDocument();
    expect(within(reasons).getByText("sales:2026-06")).toBeInTheDocument();
  });

  it("shows the anomaly, the declared gap and the pending question", () => {
    render(<AiAssessmentPanel assessment={REAL_ASSESSMENT} />);

    expect(screen.getByRole("list", { name: "Anomalías" })).toBeInTheDocument();
    expect(screen.getByText(/outlier en sales:2026-06/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Datos faltantes" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Preguntas pendientes" })).toBeInTheDocument();
  });

  it("says so plainly when there is nothing to report, rather than showing an empty list", () => {
    render(
      <AiAssessmentPanel
        assessment={{ ...REAL_ASSESSMENT, anomalies: [], missingData: [], questions: [] }}
      />
    );

    expect(screen.getByText("No se detectaron anomalías.")).toBeInTheDocument();
    expect(screen.getByText("No se declararon faltantes.")).toBeInTheDocument();
    expect(screen.getByText("No quedaron preguntas pendientes.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Anomalías" })).not.toBeInTheDocument();
  });

  it("never renders an approve action or a decision control", () => {
    render(<AiAssessmentPanel assessment={REAL_ASSESSMENT} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
