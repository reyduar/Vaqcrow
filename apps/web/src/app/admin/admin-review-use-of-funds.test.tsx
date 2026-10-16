import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
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
  company: {
    name: "Panadería Horizonte SRL",
    cuit: "30-71234567-8",
    sector: "Alimentos",
    city: "Rosario",
    description: "Panadería de barrio.",
    goalArs: 12_000_000,
    revenueShare: 5,
    deadline: null,
    useOfFunds: "Un horno rotativo <b>y</b> capital de trabajo"
  },
  documents: [],
  documentVerdicts: [],
  assessment: null,
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

async function useOfFundsSection() {
  return (await screen.findByRole("heading", { level: 2, name: "Destino de los fondos" })).closest("section") as HTMLElement;
}

describe("admin review · Destino de los fondos (#577)", () => {
  it("shows the PyME's declared use of funds as plain text, never as markup", async () => {
    renderReview(new FakePort());
    const section = await useOfFundsSection();

    expect(within(section).getByText("Un horno rotativo <b>y</b> capital de trabajo")).toBeInTheDocument();
    expect(section.querySelector("b")).toBeNull();
    expect(within(section).queryByRole("button")).not.toBeInTheDocument();
  });

  it("reads the honest Sin dato for a company that declared none", async () => {
    const company: Record<string, unknown> = { ...CONTEXT.company };
    delete company["useOfFunds"];
    renderReview(new FakePort({ ...CONTEXT, company: company as unknown as AdminReviewContext["company"] }));
    const section = await useOfFundsSection();

    expect(within(section).getByText("Sin dato")).toBeInTheDocument();
  });

  it("reads the honest Sin dato for an application without a company", async () => {
    renderReview(new FakePort({ ...CONTEXT, company: null }));
    const section = await useOfFundsSection();

    expect(within(section).getByText("Sin dato")).toBeInTheDocument();
  });
});
