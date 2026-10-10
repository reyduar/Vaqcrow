import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { CampaignDetail, CampaignDetailPort } from "@/application/ports/campaign-detail-port";
import { CampaignDetail as CampaignDetailController } from "./campaign-detail";

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

// A fresh cache per render: SWR's global cache would otherwise leak a loaded
// detail from one test into the next (the error/404/status cases all share the
// same key).
const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

function detail(overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    campaignId: CAMPAIGN_ID,
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    city: "Rosario",
    description: "Panificados artesanales para comercios de cercanía.",
    foundedAt: "2021-05-01T12:00:00.000Z",
    goalArs: 9_450_000,
    raisedArs: 5_954_000,
    fundedPercentBps: 6_300,
    revenueShare: 4.5,
    riskBand: "medium",
    riskConfidence: 0.8,
    closeDate: "2026-11-30T12:00:00.000Z",
    imageSrc: null,
    status: "funding",
    backers: 12,
    vaultAddress: null,
    vaultExplorerUrl: null,
    assessment: {
      riskBand: "medium",
      confidence: 0.72,
      reasons: ["Ventas estables durante el período"],
      model: "evaluador-v1",
      generatedAt: "2026-09-12T10:42:00.000Z"
    },
    decision: {
      actor: "M. Pereyra",
      reason: "Documentación completa",
      approvedLimitArs: 9_450_000,
      recordedAt: "2026-09-13T09:15:00.000Z"
    },
    salesEvidence: {
      averageMonthlyArs: 3_700_000,
      declaredMonths: 2,
      totalMonths: 3,
      months: [
        { period: "2026-01", salesArs: 3_150_000, status: "reported", source: "Declaración mensual sintética" },
        { period: "2026-02", salesArs: null, status: "missing", source: "Declaración mensual sintética" },
        { period: "2026-03", salesArs: 4_250_000, status: "anomalous", source: "Declaración mensual sintética" }
      ]
    },
    ...overrides
  };
}

function renderDetail(port: CampaignDetailPort | null, signedIn = true) {
  return render(<CampaignDetailController campaignId={CAMPAIGN_ID} signedIn={signedIn} port={port} />, { wrapper });
}

describe("CampaignDetail (account gate)", () => {
  it("renders the gate card and never fetches when signed out", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, detail: detail() });

    renderDetail({ get }, false);

    expect(
      screen.getByRole("heading", { level: 1, name: "Ingresá para ver esta campaña" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingresar como inversor" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Ingresar como PyME" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Creá una" })).toHaveAttribute("href", "/signup");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(get).not.toHaveBeenCalled();
  });
});

describe("CampaignDetail (states)", () => {
  it("shows a loading skeleton before the detail resolves", async () => {
    const get = vi.fn().mockResolvedValue({ ok: true, detail: detail() });

    renderDetail({ get });

    expect(screen.getByText("Cargando campaña")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Panadería Horizonte SRL" })).toBeInTheDocument());
  });

  it("shows the error state and retries through the port", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "network" })
      .mockResolvedValueOnce({ ok: true, detail: detail() });

    renderDetail({ get });

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("No pudimos cargar la campaña")).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Panadería Horizonte SRL" })).toBeInTheDocument());
  });

  it("renders a clear not-found state with a way back to the marketplace", async () => {
    const port: CampaignDetailPort = { get: vi.fn().mockResolvedValue({ ok: false, code: "not_found" }) };

    renderDetail(port);

    expect(await screen.findByRole("heading", { level: 1, name: "No encontramos esta campaña" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a Explorar PyMEs" })).toHaveAttribute("href", "/explore");
  });
});

describe("CampaignDetail (detail sections)", () => {
  it("renders the header, the SME facts and the AI/human sections from the contract", async () => {
    renderDetail({ get: vi.fn().mockResolvedValue({ ok: true, detail: detail() }) });

    await screen.findByRole("heading", { level: 1, name: "Panadería Horizonte SRL" });
    expect(screen.getAllByText("Panificados artesanales para comercios de cercanía.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alimentos").length).toBeGreaterThan(0);
    expect(screen.getByText("KYC aprobado · SIMULADO")).toBeInTheDocument();
    expect(screen.getByText("Rosario")).toBeInTheDocument();
    expect(screen.getByText("01/05/2021")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "Recomendación de IA" })).toBeInTheDocument();
    expect(screen.getByText("Ventas estables durante el período")).toBeInTheDocument();
    expect(screen.getByText(/evaluador-v1/)).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: "Decisión humana" })).toBeInTheDocument();
    expect(screen.getByText("M. Pereyra")).toBeInTheDocument();
    expect(screen.getByText("ARS 9.450.000")).toBeInTheDocument();
  });

  it("renders the aside terms and the funding progress", async () => {
    renderDetail({ get: vi.fn().mockResolvedValue({ ok: true, detail: detail() }) });

    await screen.findByRole("heading", { level: 1, name: "Panadería Horizonte SRL" });
    const aside = screen.getByRole("complementary", { name: "Aportar a la campaña" });

    expect(within(aside).getByText("Fondeo abierto")).toBeInTheDocument();
    expect(within(aside).getByText("ARS 5.954.000")).toBeInTheDocument();
    expect(within(aside).getByText("de ARS 9.450.000 · 12 aportantes")).toBeInTheDocument();
    expect(within(aside).getByText("63 % de la meta")).toBeInTheDocument();
    expect(within(aside).getByText("Cierra el 30/11/2026")).toBeInTheDocument();
    expect(within(aside).getByText("4,5 % de ventas")).toBeInTheDocument();
    expect(within(aside).getByText("RS-2026-01")).toBeInTheDocument();
    expect(within(aside).getByText("10 XLM de prueba")).toBeInTheDocument();
    expect(within(aside).getByText("Fijado por contrato · inmutable")).toBeInTheDocument();
    expect(
      within(aside).getByText(
        "Todo aporte está sujeto a riesgo. Las ventas pasadas de esta PyME, además de ser sintéticas, no anticipan resultados futuros."
      )
    ).toBeInTheDocument();
    expect(
      within(aside).getByText("Podés retirar tu aporte mientras el fondeo siga abierto. Freighter firma; Vaqcrow nunca recibe tu seed.")
    ).toBeInTheDocument();
  });

  it("links the vault to the explorer in the aside when the API sends its URL (#438/WU5)", async () => {
    const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
    const url = `https://explorer.example/contract/${VAULT}`;
    renderDetail({
      get: vi.fn().mockResolvedValue({ ok: true, detail: detail({ vaultAddress: VAULT, vaultExplorerUrl: url }) })
    });

    await screen.findByRole("heading", { level: 1, name: "Panadería Horizonte SRL" });
    const aside = screen.getByRole("complementary", { name: "Aportar a la campaña" });
    const link = within(aside).getByRole("link", {
      name: `Ver bóveda ${VAULT} en el explorador (abre en una pestaña nueva)`
    });
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveTextContent("Ver bóveda en el explorador");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("shows the vault without a link when there is no explorer URL, and «Sin dato» without a vault", async () => {
    const VAULT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
    const port = { get: vi.fn().mockResolvedValue({ ok: true, detail: detail({ vaultAddress: VAULT }) }) };
    const { unmount } = renderDetail(port);

    await screen.findByRole("heading", { level: 1, name: "Panadería Horizonte SRL" });
    let aside = screen.getByRole("complementary", { name: "Aportar a la campaña" });
    expect(within(aside).getByText("Bóveda")).toBeInTheDocument();
    expect(within(aside).getByTitle(VAULT)).toBeInTheDocument();
    expect(within(aside).queryByRole("link", { name: /bóveda/ })).not.toBeInTheDocument();
    unmount();

    renderDetail({ get: vi.fn().mockResolvedValue({ ok: true, detail: detail() }) });
    await screen.findByRole("heading", { level: 1, name: "Panadería Horizonte SRL" });
    aside = screen.getByRole("complementary", { name: "Aportar a la campaña" });
    const term = within(aside).getByText("Bóveda");
    expect(term.closest("div")).toHaveTextContent("Sin dato");
  });

  it("adapts the aside status badge per campaign status", async () => {
    const cases: ReadonlyArray<[CampaignDetail["status"], string]> = [
      ["funding", "Fondeo abierto"],
      ["settled", "Meta alcanzada"],
      ["refunding", "Reembolso disponible"]
    ];

    for (const [status, label] of cases) {
      const { unmount } = renderDetail({ get: vi.fn().mockResolvedValue({ ok: true, detail: detail({ status }) }) });
      await screen.findByRole("heading", { level: 1, name: "Panadería Horizonte SRL" });
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders the persisted sales evidence: KPIs, a missing 'Sin dato' bar and the source table", async () => {
    renderDetail({ get: vi.fn().mockResolvedValue({ ok: true, detail: detail() }) });

    await screen.findByRole("heading", { level: 1, name: "Panadería Horizonte SRL" });

    const section = screen.getByRole("region", { name: "Evidencia de ventas" });
    expect(within(section).getByText("Promedio mensual")).toBeInTheDocument();
    expect(within(section).getByText("ARS 3.700.000")).toBeInTheDocument();
    expect(within(section).getByText("Períodos declarados")).toBeInTheDocument();
    expect(within(section).getByText("2 de 3")).toBeInTheDocument();
    // Average × revenue share (4,5 %): 3.700.000 × 0,045 = 166.500.
    expect(within(section).getByText("Distribución estimada/mes")).toBeInTheDocument();
    expect(within(section).getByText("ARS 166.500")).toBeInTheDocument();

    // The missing month is never rendered as a zero.
    expect(within(section).getAllByText("Sin dato").length).toBeGreaterThan(0);
    expect(within(section).queryByText("ARS 0")).not.toBeInTheDocument();

    // The source table travels with each period's provenance.
    expect(within(section).getByText("Ver tabla con fuente y procedencia")).toBeInTheDocument();
    expect(within(section).getAllByText(/Declaración mensual sintética/).length).toBeGreaterThan(0);
  });

  it("keeps the honest 'Sin dato' section when there is no persisted sales evidence", async () => {
    renderDetail({ get: vi.fn().mockResolvedValue({ ok: true, detail: detail({ salesEvidence: null }) }) });

    await screen.findByRole("heading", { level: 1, name: "Panadería Horizonte SRL" });

    const section = screen.getByRole("region", { name: "Evidencia de ventas" });
    expect(within(section).getByText(/Sin dato/)).toBeInTheDocument();
    expect(within(section).queryByText("Promedio mensual")).not.toBeInTheDocument();
  });

  it("renders the honest 'Sin dato' fallbacks and never invents a percentage", async () => {
    renderDetail({
      get: vi.fn().mockResolvedValue({
        ok: true,
        detail: detail({ raisedArs: null, assessment: null, decision: null, riskBand: null, riskConfidence: null })
      })
    });

    await screen.findByRole("heading", { level: 1, name: "Panadería Horizonte SRL" });

    expect(screen.getAllByText(/Sin dato/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ARS 0\b/)).not.toBeInTheDocument();
    // The sales evidence and the uses of funds are not persisted: no invented section values.
    expect(screen.getByRole("heading", { level: 2, name: "Destino de los fondos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Evidencia de ventas" })).toBeInTheDocument();
  });
});
