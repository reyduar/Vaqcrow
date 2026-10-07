import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationAssessmentRead } from "@vaqcrow/contracts";
import type {
  AdminDocumentFileResult,
  AdminReviewContext,
  AdminReviewPort,
  AdminReviewResult,
  RecordDecisionResult,
  SetDocumentVerdictResult
} from "@/application/ports/admin-review-port";
import { ApplicationReview } from "@/presentation/components/admin/application-review";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/pymes"
}));

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";

const ASSESSMENT: ApplicationAssessmentRead = {
  assessment: {
    assessmentId: "asm_demo-001",
    riskBand: "medium",
    confidence: 0.72,
    reasons: [{ claim: "Ventas estables, 7 de 8 períodos declarados.", evidenceRefs: ["sales:2026-01"] }],
    anomalies: [{ type: "outlier", evidenceRef: "sales:2026-06", severity: "review" }],
    missingData: ["Declaración de abril 2026."],
    recommendedAction: "human_review",
    questions: ["¿Qué explica el pico de junio?"]
  },
  metadata: {
    model: "evaluador-v1",
    promptVersion: "prompt-v3",
    generatedAt: "2026-09-12T13:40:00.000Z",
    source: "provider"
  },
  recordedAt: "2026-09-12T13:42:00.000Z"
};

const CONTEXT: AdminReviewContext = {
  applicationId: APPLICATION_ID,
  state: "human_review",
  smeRequest: {
    smeReference: "sme-001",
    declaredTotalArs: 1_500_000,
    periodStart: "2026-01",
    periodEnd: "2026-06",
    simuladoLabel: "SIMULADO"
  },
  company: null,
  documents: [],
  documentVerdicts: [],
  assessment: ASSESSMENT,
  latestHumanDecision: null
};

class FakePort implements AdminReviewPort {
  constructor(readonly context: AdminReviewContext = CONTEXT) {}

  async getContext(): Promise<AdminReviewResult> {
    return { ok: true, context: this.context };
  }

  async setDocumentVerdict(): Promise<SetDocumentVerdictResult> {
    return { ok: false, code: "unavailable" };
  }

  async downloadDocument(): Promise<AdminDocumentFileResult> {
    return { ok: false, code: "unavailable" };
  }

  async recordDecision(): Promise<RecordDecisionResult> {
    return { ok: false, code: "unavailable" };
  }
  async getDeployment() {
    return { ok: false, code: "not_found" } as const;
  }

  async deploy() {
    return { ok: false, code: "unavailable" } as const;
  }
}

function swr({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function renderReview(port: FakePort) {
  return render(<ApplicationReview applicationId={APPLICATION_ID} port={port} openWindow={vi.fn()} />, {
    wrapper: swr
  });
}

async function aiSection() {
  return (await screen.findByRole("heading", { level: 2, name: "2 · Recomendación de IA" })).closest(
    "section"
  ) as HTMLElement;
}

describe("admin review · 2 · Recomendación de IA", () => {
  it("labels the section as advisory: it never approves", async () => {
    renderReview(new FakePort());
    const section = await aiSection();

    expect(within(section).getByText("Consultiva · no aprueba")).toBeInTheDocument();
    expect(within(section).queryByRole("button")).not.toBeInTheDocument();
    expect(within(section).queryByText(/aprobad/i)).not.toBeInTheDocument();
  });

  it("shows risk and confidence as text chips, with the risk icon hidden from assistive tech", async () => {
    renderReview(new FakePort());
    const section = await aiSection();

    const risk = within(section).getByText("Riesgo medio");
    expect(risk.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(within(section).getByText("Confianza 0,72")).toBeInTheDocument();
  });

  it("lists the reasons, anomalies, missing data and suggested questions in the template's order", async () => {
    renderReview(new FakePort());
    const section = await aiSection();

    const items = within(within(section).getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Ventas estables, 7 de 8 períodos declarados.Evidencia: sales:2026-01",
      "Anomalía: valor atípico en sales:2026-06 · a revisar",
      "Faltante: Declaración de abril 2026.",
      "Pregunta sugerida: ¿Qué explica el pico de junio?"
    ]);
    expect(items[1]).toHaveClass("text-trust-caution");
  });

  it("closes with the model and the timestamp, and no SIMULADO badge for a provider assessment", async () => {
    renderReview(new FakePort());
    const section = await aiSection();

    expect(within(section).getByText("evaluador-v1 · 12/09/2026 10:42")).toBeInTheDocument();
    expect(within(section).queryByText("SIMULADO")).not.toBeInTheDocument();
  });

  it("labels a simulated assessment next to its origin", async () => {
    renderReview(
      new FakePort({ ...CONTEXT, assessment: { ...ASSESSMENT, metadata: { ...ASSESSMENT.metadata, source: "simulated" } } })
    );
    const section = await aiSection();

    expect(within(section).getByText("SIMULADO")).toBeInTheDocument();
  });

  it("states plainly that there is no assessment yet, without chips or a footer", async () => {
    renderReview(new FakePort({ ...CONTEXT, assessment: null }));
    const section = await aiSection();

    expect(
      within(section).getByText("Todavía no hay ninguna evaluación de IA registrada para esta solicitud.")
    ).toBeInTheDocument();
    expect(within(section).getByText("Consultiva · no aprueba")).toBeInTheDocument();
    expect(within(section).queryByText(/^Riesgo/)).not.toBeInTheDocument();
    expect(within(section).queryByText(/^Confianza/)).not.toBeInTheDocument();
    expect(within(section).queryByRole("list")).not.toBeInTheDocument();
  });
});
