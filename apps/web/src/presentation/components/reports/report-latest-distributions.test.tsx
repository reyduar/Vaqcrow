import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReportLatestDistribution } from "@/application/ports/report-port";
import { ReportLatestDistributions } from "./report-latest-distributions";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const DISTRIBUTIONS: readonly ReportLatestDistribution[] = [
  {
    date: "2026-09-26T12:00:00.000Z",
    pyme: "Café Tostadero del Paraná",
    declaredSalesArs: 3_870_000,
    shareXlm: "4.0850000",
    state: "confirmed",
    transactionHash: HASH_A,
    explorerUrl: `https://explorer.example/tx/${HASH_A}`
  },
  {
    date: "2026-08-28T12:00:00.000Z",
    pyme: "Panadería Horizonte SRL",
    declaredSalesArs: null,
    shareXlm: null,
    state: "submitted",
    transactionHash: HASH_B,
    explorerUrl: null
  }
];

describe("ReportLatestDistributions proof (#438/WU5)", () => {
  it("adds a Transacción column with the hash and its explorer link only when the API sent one", () => {
    render(<ReportLatestDistributions distributions={DISTRIBUTIONS} />);

    expect(screen.getByRole("columnheader", { name: "Transacción" })).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    const link = within(rows[0]!).getByRole("link", {
      name: `Ver en el explorador: hash de la transacción ${HASH_A} (abre en una pestaña nueva)`
    });
    expect(link).toHaveAttribute("href", `https://explorer.example/tx/${HASH_A}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(within(rows[1]!).getByTitle(HASH_B)).toBeInTheDocument();
    expect(within(rows[1]!).queryByRole("link")).not.toBeInTheDocument();
  });
});
