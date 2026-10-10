import { describe, expect, it } from "vitest";
import type { ReportContributionTransaction } from "@/application/ports/report-port";
import { toContributionTransactionRows } from "./contribution-transactions";

const HASH = "b".repeat(64);
const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";

const TRANSACTIONS: readonly ReportContributionTransaction[] = [
  {
    date: "2026-09-02T10:05:00.000Z",
    pyme: "Café Tostadero del Paraná",
    amountXlm: "100.0000000",
    transactionHash: HASH,
    explorerUrl: `https://explorer.example/tx/${HASH}`,
    vaultAddress: VAULT,
    vaultExplorerUrl: null
  },
  {
    date: "2026-08-20T10:05:00.000Z",
    pyme: "Panadería Horizonte SRL",
    amountXlm: "250.5000000",
    transactionHash: "c".repeat(64),
    explorerUrl: null,
    vaultAddress: VAULT,
    vaultExplorerUrl: `https://explorer.example/contract/${VAULT}`
  }
];

describe("toContributionTransactionRows", () => {
  it("formats the date and amount and keeps the API's (newest first, period-filtered) order", () => {
    const rows = toContributionTransactionRows(TRANSACTIONS);

    expect(rows.map((row) => row.date)).toEqual(["02/09/2026", "20/08/2026"]);
    expect(rows[0]).toEqual({
      date: "02/09/2026",
      pyme: "Café Tostadero del Paraná",
      amount: "100,0000000 XLM",
      transactionHash: HASH,
      explorerUrl: `https://explorer.example/tx/${HASH}`,
      vaultAddress: VAULT,
      vaultExplorerUrl: null
    });
    expect(rows[1]!.amount).toBe("250,5000000 XLM");
    expect(rows[1]!.vaultExplorerUrl).toBe(`https://explorer.example/contract/${VAULT}`);
  });

  it("returns no rows for a period without observed contributions", () => {
    expect(toContributionTransactionRows([])).toEqual([]);
  });
});
