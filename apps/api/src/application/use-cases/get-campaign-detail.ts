import { campaignDetailSchema } from "@vaqcrow/contracts";
import type { CampaignDetail, CampaignDetailSalesEvidence, CampaignDetailStatus } from "@vaqcrow/contracts";
import type {
  CampaignDetailRecord,
  CampaignDetailRepositoryPort,
  CampaignDetailSalesEvidenceRecord
} from "../ports/campaign-detail-repository-port.js";
import { toFundedPercentBps, toRaisedArs } from "./list-marketplace-campaigns.js";

/**
 * The account-gated campaign detail (#422/WU1).
 *
 * It resolves a **published** campaign through the detail repository and shapes
 * the persisted facts into the portable `campaignDetailSchema`. The money math
 * mirrors the #414 listing exactly (`toRaisedArs` / `toFundedPercentBps`): a
 * snapshot conversion through the campaign's own integer FX rate (`null` when
 * there is none — an honest "sin dato", never a fabricated zero) and basis
 * points clamped to `0..10000`.
 *
 * The lifecycle `status` is derived from the persisted mirror, not invented:
 * see `deriveCampaignDetailStatus`. An unknown or unpublished campaign is
 * `not_found`; a repository failure or a malformed record both map to
 * `unavailable`, never a half-built detail.
 */

export interface GetCampaignDetailDependencies {
  readonly repository: Pick<CampaignDetailRepositoryPort, "findPublished">;
}

export type GetCampaignDetailResult =
  | { readonly ok: true; readonly value: CampaignDetail }
  | { readonly ok: false; readonly error: { readonly code: "not_found" | "unavailable" } };

/**
 * Derives the detail's lifecycle status from the persisted campaign mirror,
 * reusing the vocabulary the web already renders:
 *
 * - mirror `settled` -> `settled` ("Meta alcanzada");
 * - mirror `refundable` -> `refunding` ("Reembolso disponible");
 * - mirror `open` with the goal reached -> `settled` (the vault settles even
 *   before the mirror reconciles the transition);
 * - mirror `open` past its deadline under the goal -> `refunding` (the
 *   contract accepts refunds from any signer once the deadline has passed);
 * - otherwise -> `funding` ("Fondeo abierto").
 *
 * The published view only exposes `open` campaigns, so the first two branches
 * keep the function total for any future caller.
 */
export function deriveCampaignDetailStatus(
  record: Pick<CampaignDetailRecord, "state" | "deadline" | "totalStroops" | "goalStroops">,
  now: Date
): CampaignDetailStatus {
  if (record.state === "settled") return "settled";
  if (record.state === "refundable") return "refunding";
  if (record.totalStroops >= record.goalStroops) return "settled";
  if (now.getTime() >= Date.parse(record.deadline)) return "refunding";
  return "funding";
}

/**
 * Shapes the persisted sales periods into the contract's evidence block. The
 * average is the mean of the **declared** months only: a `missing` month is
 * excluded, never counted as zero, and an `anomalous` month is a declaration
 * too. `declaredMonths` counts non-null amounts; `totalMonths` is the window
 * size. Returns `null` when nothing was persisted — the honest "sin dato".
 */
export function toCampaignDetailSalesEvidence(
  record: CampaignDetailSalesEvidenceRecord | undefined
): CampaignDetailSalesEvidence | null {
  if (record === undefined || record.months.length === 0) return null;

  const months = record.months.map((month) => ({
    period: month.period,
    salesArs: month.salesArs === null ? null : Number(month.salesArs),
    status: month.status,
    source: month.source
  }));

  let declaredSum = 0;
  let declaredMonths = 0;
  for (const month of months) {
    if (month.salesArs !== null) {
      declaredSum += month.salesArs;
      declaredMonths += 1;
    }
  }

  return {
    averageMonthlyArs: declaredMonths === 0 ? null : Math.round(declaredSum / declaredMonths),
    declaredMonths,
    totalMonths: months.length,
    months
  };
}

function toCampaignDetail(record: CampaignDetailRecord, now: Date): CampaignDetail {
  const assessment = record.assessment;
  return campaignDetailSchema.parse({
    campaignId: record.campaignId,
    name: record.name,
    sector: record.sector,
    city: record.city,
    description: record.description,
    foundedAt: record.foundedAt,
    goalArs: Number(record.goalArs),
    raisedArs: toRaisedArs(record.totalStroops, record.rateSnapshot),
    fundedPercentBps: toFundedPercentBps(record.totalStroops, record.goalStroops),
    revenueShare: record.revenueShare,
    // The top-level risk is the assessment's own risk, so both surfaces agree.
    riskBand: assessment === null ? null : assessment.riskBand,
    riskConfidence: assessment === null ? null : assessment.confidence,
    closeDate: record.deadline,
    // The API-relative path of the real PyME photo; the private object path
    // never leaves the database. `null` when the PyME has no photo.
    imageUrl: record.hasImage ? `/marketplace/campaigns/${record.campaignId}/image` : null,
    status: deriveCampaignDetailStatus(record, now),
    backers: record.backers,
    vaultAddress: record.vaultAddress,
    assessment:
      assessment === null
        ? null
        : {
            riskBand: assessment.riskBand,
            confidence: assessment.confidence,
            reasons: [...assessment.reasons],
            model: assessment.model,
            generatedAt: assessment.generatedAt
          },
    decision:
      record.decision === null
        ? null
        : {
            actor: record.decision.actor,
            reason: record.decision.reason,
            approvedLimitArs:
              record.decision.approvedLimitArs === null ? null : Number(record.decision.approvedLimitArs),
            recordedAt: record.decision.recordedAt
          },
    salesEvidence: toCampaignDetailSalesEvidence(record.salesEvidence)
  });
}

export async function getCampaignDetail(
  dependencies: GetCampaignDetailDependencies,
  campaignId: string,
  now: Date = new Date()
): Promise<GetCampaignDetailResult> {
  const found = await dependencies.repository.findPublished(campaignId);
  if (!found.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }
  if (found.value === undefined) {
    return { ok: false, error: { code: "not_found" } };
  }

  try {
    return { ok: true, value: toCampaignDetail(found.value, now) };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}
