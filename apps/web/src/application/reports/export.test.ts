import { describe, expect, it } from "vitest";
import type { InvestorReport, ReportSalesByPyme } from "@/application/ports/report-port";
import { buildReportCsv } from "./export";

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
        pyme: 'Café, "Tostadero"',
        declaredSalesArs: 3_870_000,
        shareXlm: "4.0850000",
        state: "submitted",
        transactionHash: "a".repeat(64),
        explorerUrl: null
      },
      {
        date: "2026-08-20T12:00:00.000Z",
        pyme: "Panadería",
        declaredSalesArs: null,
        shareXlm: null,
        state: "failed",
        transactionHash: "b".repeat(64),
        explorerUrl: null
      }
    ],
    contributionTransactions: [],
    ...overrides
  };
}

function sales(overrides: Partial<ReportSalesByPyme> = {}): ReportSalesByPyme {
  return {
    pymes: [
      {
        name: 'Café, "Tostadero"',
        sector: "Gastronomía, Rosario",
        imageSrc: null,
        period: "2026-08",
        salesArs: 3_902_100,
        status: "reported"
      }
    ],
    ...overrides
  };
}

describe("buildReportCsv", () => {
  it("starts with a UTF-8 BOM and terminates every row with CRLF", () => {
    const csv = buildReportCsv(report());

    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    // No bare LF anywhere: every newline is part of a CRLF pair.
    expect(csv.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("keeps the Aportes column order with canonical XLM and null as an empty cell", () => {
    const csv = buildReportCsv(report());

    expect(csv).toContain("Período,abril – septiembre 2026");
    expect(csv).toContain("Métrica,Valor,Detalle,Fuente");
    expect(csv).toContain("Aportado en el período,850.0000000,,TESTNET");
    expect(csv).toContain("Distribuciones confirmadas,17.3750000,,SIMULADO");
    expect(csv).toContain("Pendientes de confirmación,1,4.0850000,TESTNET");
    expect(csv).toContain("Campañas con aporte,3,,SIMULADO");
  });

  it("renders the monthly series with the state vocabulary and no fabricated zero", () => {
    const csv = buildReportCsv(report());

    expect(csv).toContain("Período,Mes,XLM,Estado");
    expect(csv).toContain("2026-04,abril 2026,,Sin distribución");
    expect(csv).toContain("2026-08,agosto 2026,4.1200000,Confirmada");
    expect(csv).toContain("2026-09,septiembre 2026,4.0850000,Pendiente de confirmación");
    expect(csv).not.toContain(",0,");
    expect(csv).not.toContain(",0.0000000,");
  });

  it("escapes fields containing commas and quotes", () => {
    const csv = buildReportCsv(report());

    expect(csv).toContain('"Café, ""Tostadero"""');
  });

  it("leaves a null declared sale and share as empty cells, never zero", () => {
    const csv = buildReportCsv(report());

    expect(csv).toContain("Fecha,PyME,Ventas declaradas (ARS),Participación (XLM),Estado");
    expect(csv).toContain("20/08/2026,Panadería,,,Fallida");
    expect(csv).toContain('26/09/2026,"Café, ""Tostadero""",3870000,4.0850000,Enviada · pendiente');
  });

  it("adds the hash and explorer URL columns to the distributions, null URL as an empty cell (#438/WU5)", () => {
    const base = report();
    const csv = buildReportCsv(
      report({
        latestDistributions: [
          { ...base.latestDistributions[0]!, explorerUrl: `https://explorer.example/tx/${"a".repeat(64)}` },
          base.latestDistributions[1]!
        ]
      })
    );

    expect(csv).toContain(
      "Fecha,PyME,Ventas declaradas (ARS),Participación (XLM),Estado,Hash de la transacción,Explorador"
    );
    expect(csv).toContain(`Enviada · pendiente,${"a".repeat(64)},https://explorer.example/tx/${"a".repeat(64)}\r\n`);
    expect(csv).toContain(`Fallida,${"b".repeat(64)},\r\n`);
  });

  it("lists the period's contribution transactions with hash, vault and explorer URLs", () => {
    const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";
    const csv = buildReportCsv(
      report({
        contributionTransactions: [
          {
            date: "2026-09-02T10:05:00.000Z",
            pyme: "Panadería",
            amountXlm: "100.0000000",
            transactionHash: "c".repeat(64),
            explorerUrl: null,
            vaultAddress: VAULT,
            vaultExplorerUrl: `https://explorer.example/contract/${VAULT}`
          }
        ]
      })
    );

    expect(csv).toContain("Aportes confirmados\r\n");
    expect(csv).toContain(
      "Fecha,PyME,Monto (XLM),Hash de la transacción,Explorador,Bóveda,Explorador de la bóveda\r\n"
    );
    expect(csv).toContain(
      `02/09/2026,Panadería,100.0000000,${"c".repeat(64)},,${VAULT},https://explorer.example/contract/${VAULT}\r\n`
    );
  });

  it("keeps the contributions section with only its header when the period has none", () => {
    const csv = buildReportCsv(report());

    expect(csv).toContain(
      "Aportes confirmados\r\nFecha,PyME,Monto (XLM),Hash de la transacción,Explorador,Bóveda,Explorador de la bóveda\r\n"
    );
  });

  it("omits the sales-by-PyME section when no sales are present", () => {
    expect(buildReportCsv(report())).not.toContain("Ventas declaradas por PyME");
    expect(buildReportCsv(report(), null)).not.toContain("Ventas declaradas por PyME");
  });

  it("appends the sales-by-PyME section with escaped fields when sales are present", () => {
    const csv = buildReportCsv(report(), sales());

    expect(csv).toContain("Ventas declaradas por PyME");
    expect(csv).toContain("PyME,Sector,Período,Ventas (ARS),Estado");
    expect(csv).toContain('"Café, ""Tostadero""","Gastronomía, Rosario",agosto 2026,3902100,Declarada en término');
  });

  it("includes the empty sales section when the sales response has no PyME rows", () => {
    const csv = buildReportCsv(report(), { pymes: [] });

    expect(csv).toContain("Ventas declaradas por PyME");
    expect(csv).toContain("PyME,Sector,Período,Ventas (ARS),Estado");
  });
});
