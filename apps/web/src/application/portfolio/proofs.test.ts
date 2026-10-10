import { describe, expect, it } from "vitest";
import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import { PORTFOLIO_PROOF_COPY, toPositionTransactionRows, unhashedContributionLine } from "./proofs";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    contributionXlm: "350.0000000",
    raisedArs: 9_450_000,
    goalArs: 15_000_000,
    fundedPercentBps: 6_300,
    status: "funding",
    closeDate: "2026-11-30T12:00:00.000Z",
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
    vaultExplorerUrl: null,
    transactions: [
      { transactionHash: HASH_A, amountXlm: "250.0000000", observedAt: "2026-10-01T23:30:00.000Z", explorerUrl: null },
      {
        transactionHash: HASH_B,
        amountXlm: "100.0000000",
        observedAt: "2026-10-08T10:05:00.000Z",
        explorerUrl: `https://explorer.example/tx/${HASH_B}`
      }
    ],
    ...overrides
  };
}

describe("toPositionTransactionRows", () => {
  it("formats each observed contribution's own amount and UTC date, keeping the API order (oldest first)", () => {
    expect(toPositionTransactionRows(position())).toEqual([
      { transactionHash: HASH_A, amount: "250,0000000 XLM", date: "01/10/2026", explorerUrl: null },
      {
        transactionHash: HASH_B,
        amount: "100,0000000 XLM",
        date: "08/10/2026",
        explorerUrl: `https://explorer.example/tx/${HASH_B}`
      }
    ]);
  });

  it("returns no rows (never an invented hash or a zero) for a contribution made before hashes were persisted", () => {
    expect(toPositionTransactionRows(position({ transactions: [] }))).toEqual([]);
  });
});

describe("unhashedContributionLine", () => {
  it("returns null when the hashed transactions cover the whole contribution", () => {
    expect(unhashedContributionLine(position())).toBeNull();
  });

  it("returns null when no contribution has a hash (the card shows «Hash del aporte: Sin dato» instead)", () => {
    expect(unhashedContributionLine(position({ transactions: [] }))).toBeNull();
  });

  it("discloses the exact unhashed remainder of a mixed position, computed in stroops, never a zero", () => {
    expect(unhashedContributionLine(position({ contributionXlm: "350.1000001" }))).toBe(
      "Aportes anteriores sin hash registrado: 0,1000001 XLM · Sin dato"
    );
    expect(
      unhashedContributionLine(
        position({
          contributionXlm: "0.3000000",
          transactions: [
            { transactionHash: HASH_A, amountXlm: "0.1000000", observedAt: "2026-10-01T23:30:00.000Z", explorerUrl: null },
            { transactionHash: HASH_B, amountXlm: "0.1000000", observedAt: "2026-10-02T23:30:00.000Z", explorerUrl: null }
          ]
        })
      )
    ).toBe("Aportes anteriores sin hash registrado: 0,1000000 XLM · Sin dato");
  });

  it("states the gap without a number when an amount cannot be read exactly", () => {
    expect(unhashedContributionLine(position({ contributionXlm: "350.00000001" }))).toBe(
      "Hay aportes anteriores sin hash registrado"
    );
  });
});

describe("PORTFOLIO_PROOF_COPY", () => {
  it("names the missing proof «Sin dato», never a zero", () => {
    expect(PORTFOLIO_PROOF_COPY.missing).toBe("Sin dato");
  });
});
