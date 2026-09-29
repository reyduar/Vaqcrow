import { describe, expect, it } from "vitest";
import type {
  CampaignSnapshot,
  HumanDecisionRecord,
  RevenueShareDistributionSnapshot
} from "@vaqcrow/contracts";
import { failureReasonCopy } from "@/application/funding/failure-reason-copy";
import {
  buildEvidenceTimeline,
  type EvidenceEntry,
  type EvidenceSources
} from "./evidence-timeline";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SME = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const CONTRACT = "CDEMOCONTRACTV27EJOTY5CHMRW3AFKPUZ6DINSX4BGLQV27EJOTY5CH";
const CAMPAIGN_EXPLORER = "https://stellar.expert/explorer/testnet/contract/CDEMO";
const DISTRIBUTION_EXPLORER = "https://stellar.expert/explorer/testnet/tx/TRANSACTION-HASH";

const recipients = [
  { accountId: "GDISTRIBUTIONDEMOV27EJOTY5CHMRW3AFKPUZ6DINSX4BGLQV27EJOT", amountStroops: 6_000_000n },
  { accountId: "GINVESTORONEDEMOQV27EJOTY5CHMRW3AFKPUZ6DINSX4BGLQV27EJOT", amountStroops: 4_000_000n },
  { accountId: "GINVESTORTWODEMOQV27EJOTY5CHMRW3AFKPUZ6DINSX4BGLQV27EJOT", amountStroops: 3_500_000n }
];

function decision(overrides: Record<string, unknown> = {}): HumanDecisionRecord {
  return {
    decisionId: "11111111-1111-4111-8111-111111111111",
    applicationId: APPLICATION_ID,
    outcome: "approved",
    actor: "Ana Revisora",
    reason: "Cumple las condiciones del demo.",
    approvedLimitArs: 1_000_000,
    decidedAt: "2026-09-19T12:00:00.000Z",
    correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ...overrides
  } as unknown as HumanDecisionRecord;
}

function campaign(overrides: Record<string, unknown> = {}): CampaignSnapshot {
  return {
    campaignId: "123e4567-e89b-42d3-a456-4266141740ab",
    applicationId: APPLICATION_ID,
    contractAddress: CONTRACT,
    network: "testnet",
    state: "funding",
    goalStroops: 50_000_000n,
    totalStroops: 15_000_000n,
    deadline: "2026-12-01T00:00:00.000Z",
    smeAccountId: SME,
    investorContributionStroops: 5_000_000n,
    reconciliationStatus: "in_sync",
    explorerUrl: CAMPAIGN_EXPLORER,
    ...overrides
  } as unknown as CampaignSnapshot;
}

function distribution(overrides: Record<string, unknown> = {}): RevenueShareDistributionSnapshot {
  return {
    distributionId: "123e4567-e89b-42d3-a456-4266141740ab",
    network: "testnet",
    networkPassphrase: "passphrase-from-the-response",
    sourceAccountId: SME,
    sourceSequence: "1234567891",
    memo: null,
    expiresAt: "2026-09-21T12:15:00.000Z",
    recipients,
    state: "submitted",
    transactionHash: "TRANSACTION-HASH",
    applicationId: APPLICATION_ID,
    explorerUrl: DISTRIBUTION_EXPLORER,
    failureReason: null,
    lastCorrelationId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-09-21T12:00:00.000Z",
    updatedAt: "2026-09-21T12:00:05.000Z",
    ...overrides
  } as unknown as RevenueShareDistributionSnapshot;
}

function allObserved(overrides: Partial<EvidenceSources> = {}): EvidenceSources {
  return {
    applicationId: APPLICATION_ID,
    decision: { kind: "observed", value: decision() },
    campaign: { kind: "observed", value: campaign() },
    distribution: { kind: "observed", value: distribution() },
    ...overrides
  };
}

function entry(timeline: readonly EvidenceEntry[], id: EvidenceEntry["id"]): EvidenceEntry {
  const found = timeline.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing evidence entry ${id}`);
  return found;
}

describe("buildEvidenceTimeline", () => {
  it("always returns the four entries in the demo's order", () => {
    const timeline = buildEvidenceTimeline(allObserved());

    expect(timeline.map((item) => item.id)).toEqual([
      "synthetic-case",
      "human-decision",
      "campaign-vault",
      "revenue-share-distribution"
    ]);
  });

  it.each([
    ["absent", "absent"],
    ["unavailable", "unavailable"]
  ] as const)("mirrors a %s decision source without inventing facts", (kind, expected) => {
    const timeline = buildEvidenceTimeline(
      allObserved({ decision: { kind } as EvidenceSources["decision"] })
    );
    const decisionView = entry(timeline, "human-decision");

    expect(decisionView.state).toBe(expected);
    expect(decisionView.facts).toEqual([]);
    expect(decisionView.hashes).toEqual([]);
  });

  it("declares an absent decision instead of inventing an approved one", () => {
    const timeline = buildEvidenceTimeline(
      allObserved({ decision: { kind: "absent" } })
    );
    const decisionView = entry(timeline, "human-decision");

    expect(decisionView.state).toBe("absent");
    expect(decisionView.description).toMatch(/no hay una decisión humana registrada/i);
    expect(JSON.stringify(decisionView)).not.toMatch(/aprobad/i);
  });

  it("renders an absent campaign with no id in the session as a declared absence", () => {
    const timeline = buildEvidenceTimeline(
      allObserved({ campaign: { kind: "absent" } })
    );
    const campaignView = entry(timeline, "campaign-vault");

    expect(campaignView.state).toBe("absent");
    expect(campaignView.description).toMatch(/no hay una bóveda de campaña/i);
    expect(campaignView.facts).toEqual([]);
    expect(campaignView.hashes).toEqual([]);
  });

  it("never reports a failed read as observed", () => {
    const timeline = buildEvidenceTimeline(
      allObserved({ distribution: { kind: "unavailable" } })
    );
    const distributionView = entry(timeline, "revenue-share-distribution");

    expect(distributionView.state).toBe("unavailable");
    expect(distributionView.description).toMatch(/no se pudo leer/i);
    expect(distributionView.facts).toEqual([]);
    expect(distributionView.hashes).toEqual([]);
    expect(distributionView.calculation).toBeUndefined();
  });

  it("renders the observed decision's facts and does not label it SIMULADO", () => {
    const timeline = buildEvidenceTimeline(allObserved());
    const decisionView = entry(timeline, "human-decision");

    expect(decisionView.state).toBe("observed");
    expect(decisionView.badges).toEqual([]);
    expect(decisionView.facts).toContainEqual({ label: "Registrada por", value: "Ana Revisora" });
    expect(decisionView.facts).toContainEqual({ label: "Decisión", value: "Aprobada" });
    expect(decisionView.facts).toContainEqual({
      label: "Razón",
      value: "Cumple las condiciones del demo."
    });
    expect(decisionView.facts).toContainEqual({ label: "Fecha del servidor", value: "2026-09-19T12:00:00.000Z" });
    expect(decisionView.facts.map((fact) => fact.label)).toContain("Límite aprobado");
  });

  it("omits the approved limit when it is null", () => {
    const timeline = buildEvidenceTimeline(
      allObserved({
        decision: { kind: "observed", value: decision({ outcome: "rejected", approvedLimitArs: null }) }
      })
    );
    const decisionView = entry(timeline, "human-decision");

    expect(decisionView.facts.map((fact) => fact.label)).not.toContain("Límite aprobado");
    expect(decisionView.facts).toContainEqual({ label: "Decisión", value: "Rechazada" });
  });

  it("renders the observed campaign's state, amounts, deadline and reconciliation", () => {
    const timeline = buildEvidenceTimeline(allObserved());
    const campaignView = entry(timeline, "campaign-vault");

    expect(campaignView.state).toBe("observed");
    expect(campaignView.facts).toContainEqual({ label: "Estado", value: "Fondeo abierto" });
    expect(campaignView.facts).toContainEqual({ label: "Meta", value: "5 XLM" });
    expect(campaignView.facts).toContainEqual({ label: "Total aportado", value: "1.5 XLM" });
    expect(campaignView.facts).toContainEqual({ label: "Fecha límite", value: "2026-12-01T00:00:00.000Z" });
    expect(campaignView.facts).toContainEqual({
      label: "Reconciliación",
      value: "En sincronía con el ledger"
    });
    expect(campaignView.facts).toContainEqual({ label: "Tu aporte", value: "0.5 XLM" });
  });

  it("uses the investor contribution only when it is present", () => {
    const timeline = buildEvidenceTimeline(
      allObserved({ campaign: { kind: "observed", value: campaign({ investorContributionStroops: null }) } })
    );
    const campaignView = entry(timeline, "campaign-vault");

    expect(campaignView.facts.map((fact) => fact.label)).not.toContain("Tu aporte");
  });

  it("takes both explorer URLs verbatim from the snapshots", () => {
    const timeline = buildEvidenceTimeline(allObserved());

    const campaignHash = entry(timeline, "campaign-vault").hashes[0];
    const distributionHash = entry(timeline, "revenue-share-distribution").hashes[0];

    expect(campaignHash).toEqual({
      label: "Contrato de la bóveda",
      value: CONTRACT,
      explorerUrl: CAMPAIGN_EXPLORER
    });
    expect(distributionHash).toEqual({
      label: "Hash de transacción",
      value: "TRANSACTION-HASH",
      explorerUrl: DISTRIBUTION_EXPLORER
    });
  });

  it("omits the campaign explorer URL when the snapshot carries none", () => {
    const timeline = buildEvidenceTimeline(
      allObserved({ campaign: { kind: "observed", value: campaign({ explorerUrl: undefined }) } })
    );

    expect(entry(timeline, "campaign-vault").hashes).toEqual([
      { label: "Contrato de la bóveda", value: CONTRACT }
    ]);
  });

  it("labels the synthetic case SIMULADO and keeps the movements on Testnet", () => {
    const timeline = buildEvidenceTimeline(allObserved());

    expect(entry(timeline, "synthetic-case").badges).toEqual([{ variant: "simulado", label: "SIMULADO" }]);
    expect(entry(timeline, "campaign-vault").badges.map((badge) => badge.variant)).toEqual([
      "testnet",
      "evidence"
    ]);
    expect(entry(timeline, "revenue-share-distribution").badges.map((badge) => badge.variant)).toEqual([
      "testnet",
      "transaction"
    ]);
  });

  it("fills the calculation from the snapshot's recipients under the frozen rule", () => {
    const timeline = buildEvidenceTimeline(allObserved());
    const calculation = entry(timeline, "revenue-share-distribution").calculation;

    expect(calculation).toBeDefined();
    expect(calculation?.ruleId).toBe("RS-2026-01 · SIMULADO");
    expect(calculation?.inputs).toEqual([
      { label: "Destinatario 1", value: "0.6 XLM" },
      { label: "Destinatario 2", value: "0.4 XLM" },
      { label: "Destinatario 3", value: "0.35 XLM" }
    ]);
  });

  it("formats the calculation total as the recipients' exact sum", () => {
    const timeline = buildEvidenceTimeline(allObserved());
    const calculation = entry(timeline, "revenue-share-distribution").calculation;

    expect(calculation?.total).toEqual({ label: "Total distribuido", value: "1.35 XLM" });
  });

  it.each([
    ["submitted", "Enviada · pendiente de confirmación"],
    ["confirmed", "Confirmada en el ledger"],
    ["failed", "Fallida"]
  ] as const)("renders a %s distribution as %s", (state, label) => {
    const timeline = buildEvidenceTimeline(
      allObserved({
        distribution: {
          kind: "observed",
          value: distribution({
            state,
            failureReason: state === "failed" ? "insufficient_balance" : null
          })
        }
      })
    );
    const distributionView = entry(timeline, "revenue-share-distribution");

    expect(distributionView.facts).toContainEqual({ label: "Estado", value: label });
  });

  it("keeps the three distribution states distinct and never claims success", () => {
    const states = (["submitted", "confirmed", "failed"] as const).map((state) => {
      const timeline = buildEvidenceTimeline(
        allObserved({
          distribution: {
            kind: "observed",
            value: distribution({
              state,
              failureReason: state === "failed" ? "insufficient_balance" : null
            })
          }
        })
      );
      return entry(timeline, "revenue-share-distribution");
    });

    const labels = states.map(
      (distributionView) => distributionView.facts.find((fact) => fact.label === "Estado")?.value
    );
    expect(new Set(labels).size).toBe(3);
    expect(labels).not.toContain(undefined);
  });

  it("carries the mapped failure reason on a failed distribution", () => {
    const timeline = buildEvidenceTimeline(
      allObserved({
        distribution: {
          kind: "observed",
          value: distribution({ state: "failed", failureReason: "insufficient_balance" })
        }
      })
    );
    const distributionView = entry(timeline, "revenue-share-distribution");

    expect(distributionView.facts).toContainEqual({
      label: "Motivo del fallo",
      value: failureReasonCopy("insufficient_balance")
    });
    // A failed movement is never coloured or worded as a success.
    expect(distributionView.facts.some((fact) => fact.value.includes("Confirmada"))).toBe(false);
    expect(distributionView.badges.map((badge) => badge.variant)).toEqual(["testnet", "transaction"]);
  });
});
