import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReportContributionTransaction } from "@/application/ports/report-port";
import { microcopy } from "@/application/trust/disclosures";
import { ReportContributionTransactions } from "./report-contribution-transactions";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";

const TRANSACTIONS: readonly ReportContributionTransaction[] = [
  {
    date: "2026-09-02T10:05:00.000Z",
    pyme: "Café Tostadero del Paraná",
    amountXlm: "100.0000000",
    transactionHash: HASH_A,
    explorerUrl: `https://explorer.example/tx/${HASH_A}`,
    vaultAddress: VAULT,
    vaultExplorerUrl: `https://explorer.example/contract/${VAULT}`
  },
  {
    date: "2026-08-20T10:05:00.000Z",
    pyme: "Panadería Horizonte SRL",
    amountXlm: "250.5000000",
    transactionHash: HASH_B,
    explorerUrl: null,
    vaultAddress: VAULT,
    vaultExplorerUrl: null
  }
];

describe("ReportContributionTransactions (#438/WU5)", () => {
  it("lists every contribution of the period with date, PyME, amount, hash and vault proofs", () => {
    render(<ReportContributionTransactions transactions={TRANSACTIONS} />);

    expect(screen.getByRole("heading", { level: 2, name: "Aportes en el período" })).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("02/09/2026");
    expect(rows[0]).toHaveTextContent("Café Tostadero del Paraná");
    expect(rows[0]).toHaveTextContent("100,0000000 XLM");
    expect(
      within(rows[0]!).getByRole("link", {
        name: `Ver hash de la transacción ${HASH_A} en el explorador (abre en una pestaña nueva)`
      })
    ).toHaveAttribute("href", `https://explorer.example/tx/${HASH_A}`);
    expect(
      within(rows[0]!).getByRole("link", {
        name: `Ver bóveda de Café Tostadero del Paraná ${VAULT} en el explorador (abre en una pestaña nueva)`
      })
    ).toHaveAttribute("href", `https://explorer.example/contract/${VAULT}`);
    expect(within(rows[1]!).queryByRole("link")).not.toBeInTheDocument();
    expect(within(rows[1]!).getByTitle(HASH_B)).toBeInTheDocument();
    expect(screen.getAllByText(microcopy.hashTechnicalOnly)).toHaveLength(1);
  });

  it("states that the period has no confirmed contributions instead of inventing a row", () => {
    render(<ReportContributionTransactions transactions={[]} />);

    expect(screen.getByText("Sin aportes confirmados en el período.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
