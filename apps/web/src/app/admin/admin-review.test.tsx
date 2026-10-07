import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { AdminReviewContext, AdminReviewPort, AdminReviewResult } from "@/application/ports/admin-review-port";
import { ReviewView } from "@/presentation/components/admin/review-view";
import AdminReviewPage from "./(console)/pymes/[applicationId]/page";

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
    deadline: null
  },
  documents: [],
  documentVerdicts: [],
  assessment: null,
  latestHumanDecision: null
};

class FakeAdminReviewPort implements AdminReviewPort {
  readonly calls: string[] = [];
  constructor(private readonly respond: () => AdminReviewResult | Promise<AdminReviewResult>) {}
  async getContext(applicationId: string): Promise<AdminReviewResult> {
    this.calls.push(applicationId);
    return this.respond();
  }
}

function swr({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function renderView(port: AdminReviewPort, extra: Partial<Parameters<typeof ReviewView>[0]> = {}) {
  return render(<ReviewView applicationId={APPLICATION_ID} port={port} {...extra} />, { wrapper: swr });
}

describe("admin review view", () => {
  it("shows the breadcrumb back to the queue while loading", async () => {
    renderView(new FakeAdminReviewPort(() => new Promise<AdminReviewResult>(() => {})));

    const nav = screen.getByRole("navigation", { name: "Ruta" });
    expect(within(nav).getByRole("link", { name: "PyMEs" })).toHaveAttribute("href", "/admin/pymes");
    expect(nav).toHaveTextContent("PyMEs / Revisión");
    expect(await screen.findByRole("status")).toHaveTextContent("Cargando…");
  });

  it("renders the header, sub-line and state badge of the loaded application", async () => {
    const port = new FakeAdminReviewPort(() => ({ ok: true, context: CONTEXT }));
    renderView(port);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Revisión: Panadería Horizonte SRL" })
    ).toBeInTheDocument();
    expect(screen.getByText(`Alimentos · ${APPLICATION_ID}`)).toBeInTheDocument();
    expect(screen.getByText("Pendiente de revisión")).toBeInTheDocument();
    expect(port.calls).toEqual([APPLICATION_ID]);
  });

  it("renders the honest 'Sin dato' for an application without a company", async () => {
    renderView(new FakeAdminReviewPort(() => ({ ok: true, context: { ...CONTEXT, company: null, state: "rejected" } })));

    expect(await screen.findByRole("heading", { level: 1, name: "Revisión: Sin dato" })).toBeInTheDocument();
    expect(screen.getByText(`Sin dato · ${APPLICATION_ID}`)).toBeInTheDocument();
    expect(screen.getByText("Rechazada")).toBeInTheDocument();
  });

  it("hands the loaded context to the section slots and renders nothing invented without them", async () => {
    const kyc = vi.fn((context: AdminReviewContext) => <p>KYC de {context.applicationId}</p>);
    const { container } = renderView(new FakeAdminReviewPort(() => ({ ok: true, context: CONTEXT })), {
      slots: { kyc }
    });

    expect(await screen.findByText(`KYC de ${APPLICATION_ID}`)).toBeInTheDocument();
    expect(container.querySelectorAll("section")).toHaveLength(0);
  });

  it("shows a not-found state without a retry", async () => {
    renderView(new FakeAdminReviewPort(() => ({ ok: false, code: "not_found" })));

    expect(await screen.findByText("No encontramos esta solicitud.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it.each(["unavailable", "network"] as const)("shows a sanitized %s error and recovers through retry", async (code) => {
    let result: AdminReviewResult = { ok: false, code };
    const port = new FakeAdminReviewPort(() => result);
    renderView(port);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cargar la solicitud. No se modificó ningún dato.");

    result = { ok: true, context: CONTEXT };
    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Revisión: Panadería Horizonte SRL" })
    ).toBeInTheDocument();
    expect(port.calls).toHaveLength(2);
  });
});

describe("/admin/pymes/[applicationId]", () => {
  it("resolves the route param and renders the review for it", async () => {
    const element = await AdminReviewPage({ params: Promise.resolve({ applicationId: APPLICATION_ID }) });
    render(element, { wrapper: swr });

    expect(screen.getByRole("navigation", { name: "Ruta" })).toBeInTheDocument();
  });
});
