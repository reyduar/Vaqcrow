import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type {
  InvestorReport,
  ReportPort,
  ReportSalesByPyme,
  ReportSalesPort
} from "@/application/ports/report-port";
import { Reports } from "./reports";

const SWR_ISOLATED = { provider: () => new Map(), dedupingInterval: 0 } as const;

function report(overrides: Partial<InvestorReport> = {}): InvestorReport {
  return {
    range: { from: "2026-04", to: "2026-09" },
    availableRange: { firstPeriod: "2026-04", lastPeriod: "2026-09" },
    isEmpty: false,
    kpis: {
      contributedXlm: "850.0000000",
      confirmedDistributionsXlm: "17.3750000",
      pendingDistributionsCount: 1,
      pendingDistributionsXlm: "4.0850000",
      campaignsCount: 3
    },
    monthlySeries: [
      { period: "2026-04", amountXlm: null, state: "none" },
      { period: "2026-08", amountXlm: "4.1200000", state: "confirmed" },
      { period: "2026-09", amountXlm: "4.0850000", state: "pending" }
    ],
    latestDistributions: [
      {
        date: "2026-09-26T12:00:00.000Z",
        pyme: "Café Tostadero del Paraná",
        declaredSalesArs: 3_870_000,
        shareXlm: "4.0850000",
        state: "submitted"
      }
    ],
    ...overrides
  };
}

function sales(overrides: Partial<ReportSalesByPyme> = {}): ReportSalesByPyme {
  return {
    pymes: [
      {
        name: "Café Tostadero del Paraná",
        sector: "Gastronomía · Rosario",
        imageSrc: null,
        period: "2026-08",
        salesArs: 3_902_100,
        status: "reported"
      }
    ],
    ...overrides
  };
}

function okReport(value: InvestorReport = report()): ReportPort {
  return { get: vi.fn().mockResolvedValue({ ok: true, report: value }) };
}

function okSales(value: ReportSalesByPyme = sales()): ReportSalesPort {
  return { get: vi.fn().mockResolvedValue({ ok: true, sales: value }) };
}

function renderReports(props: { reportPort: ReportPort; salesPort: ReportSalesPort }) {
  const ui: ReactNode = <Reports {...props} />;
  return render(<SWRConfig value={SWR_ISOLATED}>{ui}</SWRConfig>);
}

describe("Reports container", () => {
  it("renders the template title, subtitle, KPIs and sections", async () => {
    renderReports({ reportPort: okReport(), salesPort: okSales() });

    expect(await screen.findByRole("heading", { level: 1, name: "Informes" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Actividad de tus aportes y distribuciones. Todas las cifras son simuladas o de Stellar Testnet; no hay proyecciones de retorno."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Distribuciones recibidas por mes")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ventas declaradas por PyME" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Últimas distribuciones" })).toBeInTheDocument();
  });

  it("labels each KPI with the template's source badge", async () => {
    renderReports({ reportPort: okReport(), salesPort: okSales() });

    const contributed = (await screen.findByText("Aportado en el período")).closest("dl") as HTMLElement;
    expect(within(contributed).getByText("TESTNET")).toBeInTheDocument();
    expect(within(contributed).getByText("850,0000000 XLM")).toBeInTheDocument();

    const confirmed = screen.getByText("Distribuciones confirmadas").closest("dl") as HTMLElement;
    expect(within(confirmed).getByText("SIMULADO")).toBeInTheDocument();
  });

  it("always offers the accessible monthly table with state vocabulary", async () => {
    renderReports({ reportPort: okReport(), salesPort: okSales() });

    expect(await screen.findByText("Ver tabla accesible")).toBeInTheDocument();
    const chartSection = screen.getByText("Distribuciones recibidas por mes").closest("section") as HTMLElement;
    const table = within(chartSection).getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Mes" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "XLM" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Estado" })).toBeInTheDocument();
    // A `none` month is honest in both the XLM and Estado cells (never a zero).
    expect(within(table).getAllByText("Sin distribución").length).toBeGreaterThan(0);
    expect(within(table).getByText("Pendiente de confirmación")).toBeInTheDocument();
    expect(within(table).getByText("4,0850000 XLM")).toBeInTheDocument();
  });

  it("shows the sales block's own error state and retries just that block", async () => {
    const getSales = vi.fn().mockResolvedValue({ ok: false, code: "unavailable" });
    renderReports({ reportPort: okReport(), salesPort: { get: getSales } });

    expect(await screen.findByText("No pudimos cargar este bloque")).toBeInTheDocument();
    expect(screen.getByText("El resto del informe está actualizado.")).toBeInTheDocument();
    // The rest of the report stays up.
    expect(screen.getByText("Aportado en el período")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(getSales).toHaveBeenCalledTimes(2));
  });

  it("shows the empty-period state with a CTA back to the default range", async () => {
    renderReports({
      reportPort: okReport(report({ isEmpty: true, range: { from: "2026-10", to: "2026-10" } })),
      salesPort: okSales()
    });

    expect(await screen.findByText("Sin datos para octubre 2026")).toBeInTheDocument();
    expect(
      screen.getByText("Todavía no hay aportes ni distribuciones registradas en este período. Elegí un período anterior.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver abril – septiembre 2026" })).toBeInTheDocument();
  });

  it("shows the report-level error state with retry", async () => {
    const get = vi.fn().mockResolvedValue({ ok: false, code: "network" });
    renderReports({ reportPort: { get }, salesPort: okSales() });

    expect(await screen.findByText("No pudimos cargar tu informe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("refetches the report and the sales block when a preset is selected", async () => {
    const getReport = vi.fn().mockResolvedValue({ ok: true, report: report() });
    const getSales = vi.fn().mockResolvedValue({ ok: true, sales: sales() });
    renderReports({ reportPort: { get: getReport }, salesPort: { get: getSales } });

    const select = await screen.findByLabelText("Período");
    fireEvent.change(select, { target: { value: "3m" } });

    await waitFor(() => expect(getReport).toHaveBeenCalledWith("2026-07", "2026-09"));
    await waitFor(() => expect(getSales).toHaveBeenCalledWith("2026-07", "2026-09"));
  });

  it("shows a loading status while the first read is in flight", () => {
    renderReports({
      reportPort: { get: vi.fn().mockReturnValue(new Promise(() => {})) },
      salesPort: { get: vi.fn().mockReturnValue(new Promise(() => {})) }
    });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
