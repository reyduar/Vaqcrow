import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type {
  MyCampaign,
  MyCampaigns,
  MyCampaignsPort
} from "@/application/ports/my-campaigns-port";
import { CompanyDashboard } from "./company-dashboard";

const SWR_ISOLATED = { provider: () => new Map(), dedupingInterval: 0 } as const;

const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";

function campaign(overrides: Partial<MyCampaign> = {}): MyCampaign {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Campaña 2026 · Panadería Horizonte",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    vaultAddress: VAULT,
    state: "funding",
    goalArs: 15_000_000,
    raisedArs: 9_450_000,
    fundedPercentBps: 6_300,
    deadline: "2026-11-30T12:00:00.000Z",
    contributorsCount: 38,
    distributions: [
      {
        distributionId: "11111111-1111-4111-8111-111111111111",
        period: "2026-08",
        amountArs: 168_561,
        amountXlm: "1.2500000",
        state: "submitted"
      }
    ],
    sales: [
      { period: "2026-06", salesArs: 6_240_000, status: "anomalous" },
      { period: "2026-08", salesArs: 3_745_800, status: "reported" },
      { period: "2026-07", salesArs: null, status: "missing" }
    ],
    ...overrides
  };
}

function myCampaigns(overrides: Partial<MyCampaigns> = {}): MyCampaigns {
  return { campaigns: [campaign()], ...overrides };
}

function okPort(value: MyCampaigns = myCampaigns()): MyCampaignsPort {
  return { get: vi.fn().mockResolvedValue({ ok: true, myCampaigns: value }) };
}

function renderDashboard(props: Parameters<typeof CompanyDashboard>[0]) {
  const ui: ReactNode = <CompanyDashboard {...props} />;
  return render(<SWRConfig value={SWR_ISOLATED}>{ui}</SWRConfig>);
}

describe("CompanyDashboard", () => {
  it("renders the vault, sales and distributions sections with the footnote", async () => {
    renderDashboard({ port: okPort() });

    expect(await screen.findByRole("heading", { name: "Bóveda y distribuciones" })).toBeInTheDocument();
    expect(screen.getByText("Fondeado")).toBeInTheDocument();
    expect(screen.getByText("ARS 9.450.000")).toBeInTheDocument();
    expect(screen.getByText("de ARS 15.000.000 · cierra el 30/11/2026")).toBeInTheDocument();
    expect(screen.getByText("Aportantes")).toBeInTheDocument();
    expect(screen.getByText("Cuentas de Testnet distintas")).toBeInTheDocument();

    expect(screen.getByText("Campaña 2026 · Panadería Horizonte")).toBeInTheDocument();
    expect(screen.getByText("Bóveda CDLZ…N4B2")).toBeInTheDocument();
    expect(screen.getByText("Fondeo abierto · 38 aportantes")).toBeInTheDocument();
    expect(screen.getByText("Destino de liquidación fijado por el contrato; es inmutable.")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Ventas declaradas · 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Distribuciones" })).toBeInTheDocument();
    expect(screen.getByText("Cálculo determinístico; la IA no calcula esta obligación")).toBeInTheDocument();
  });

  it("renders the nested distribution with ARS, approximate XLM and state", async () => {
    renderDashboard({ port: okPort() });

    expect(await screen.findByText("ARS 168.561 ·")).toBeInTheDocument();
    expect(screen.getByText("≈ 1,2500000 XLM")).toBeInTheDocument();
    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();
    expect(screen.getAllByText("Calculada · pendiente de tu firma").length).toBeGreaterThan(0);
  });

  it("reuses the bar-chart status markers for missing and anomalous months", async () => {
    renderDashboard({ port: okPort() });

    expect(await screen.findByRole("heading", { name: "Ventas declaradas · 2026" })).toBeInTheDocument();
    expect(screen.getAllByText("Sin dato").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Atípico").length).toBeGreaterThan(0);
  });

  it("shows the two sort options and reorders the vault list by state", async () => {
    const two = myCampaigns({
      campaigns: [
        campaign({ campaignId: "a", name: "Campaña Alfa", state: "settled", distributions: [] }),
        campaign({ campaignId: "b", name: "Campaña Beta", state: "funding", distributions: [] })
      ]
    });
    renderDashboard({ port: okPort(two) });

    const section = (await screen.findByRole("heading", { name: "Bóveda y distribuciones" })).closest("section") as HTMLElement;
    expect(within(section).getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual([
      "Campaña Alfa",
      "Campaña Beta"
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Por estado" }));
    expect(within(section).getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual([
      "Campaña Beta",
      "Campaña Alfa"
    ]);
  });

  it("renders the declare and sign slots disabled with an honest reason while they are unwired", async () => {
    renderDashboard({ port: okPort() });

    const declare = await screen.findByRole("button", { name: "Declarar ventas" });
    expect(declare).toBeDisabled();
    const sign = screen.getByRole("button", { name: "Revisar y firmar" });
    expect(sign).toBeDisabled();
    expect(screen.getAllByText("Disponible próximamente").length).toBeGreaterThan(0);
  });

  it("calls the injected slots when a handler is provided", async () => {
    const onDeclareSales = vi.fn();
    const onReviewAndSign = vi.fn();
    renderDashboard({ port: okPort(), onDeclareSales, onReviewAndSign });

    fireEvent.click(await screen.findByRole("button", { name: "Declarar ventas" }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar y firmar" }));

    expect(onDeclareSales).toHaveBeenCalledTimes(1);
    expect(onReviewAndSign).toHaveBeenCalledTimes(1);
  });

  it("shows a loading status while the first read is in flight", () => {
    renderDashboard({ port: { get: vi.fn().mockReturnValue(new Promise(() => {})) } });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the error state with retry", async () => {
    const get = vi.fn().mockResolvedValue({ ok: false, code: "network" });
    renderDashboard({ port: { get } });

    expect(await screen.findByText("No pudimos cargar tu campaña")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("shows the pre-vault empty state when the PyME has no campaign", async () => {
    renderDashboard({ port: okPort({ campaigns: [] }) });

    expect(await screen.findByText("Todavía no tenés una campaña")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bóveda y distribuciones" })).not.toBeInTheDocument();
  });
});
