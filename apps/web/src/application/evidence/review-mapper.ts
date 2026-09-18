import type { ReviewFinding, SalesPeriodContract, SmeRequest } from "@vaqcrow/contracts";
import { contradictoryRequest, contradictorySalesPeriods } from "@/application/fixtures/contradictory-request";
import { panaderiaHorizonte } from "@/application/fixtures/panaderia-horizonte";
import {
  deriveReviewFindings,
  resolveEvidenceRef,
  type EvidenceRegistry,
  type ReviewablePeriod
} from "./evidence-review";
import type { EvidenceReviewItem, ReviewEvidence } from "./review-view-model";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
] as const;

const PERIOD_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const arsFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0
});

export function formatArs(amount: number): string {
  return arsFormatter.format(amount);
}

/** "2026-04" -> "Abril 2026". Anything unexpected is returned as-is, never guessed. */
export function formatPeriodLabel(period: string): string {
  const match = PERIOD_PATTERN.exec(period);
  if (!match) return period;
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** Period with the provenance the UI can cite once its evidence reference resolves. */
export interface EvidencedPeriod extends ReviewablePeriod {
  readonly provenance: string;
}

/**
 * Registers evidence for periods that carry data. A `missing` period has
 * nothing to cite, so its reference stays unresolved rather than being backed
 * by invented provenance.
 */
export function buildEvidenceRegistry(periods: readonly EvidencedPeriod[]): EvidenceRegistry {
  const entries: Record<string, { provenance: string }> = {};
  for (const period of periods) {
    if (period.status !== "missing") entries[period.evidenceRef] = { provenance: period.provenance };
  }
  return entries;
}

export interface MapFindingsInput {
  readonly findings: readonly ReviewFinding[];
  /** `undefined` while the request is unknown: totals are then left out, not invented. */
  readonly request: Pick<SmeRequest, "declaredTotalArs"> | undefined;
  readonly periods: readonly ReviewablePeriod[];
  readonly registry: EvidenceRegistry;
}

function toEvidence(ref: string, registry: EvidenceRegistry): ReviewEvidence {
  const resolution = resolveEvidenceRef(ref, registry);
  return resolution.status === "resolved"
    ? { status: "resolved", ref: resolution.ref, provenance: resolution.entry.provenance }
    : { status: "unresolved", ref: resolution.ref };
}

export function mapFindingsToReviewItems(input: MapFindingsInput): readonly EvidenceReviewItem[] {
  // Same rule as `deriveReviewFindings`: only reported periods add up.
  const reportedSum = input.periods
    .filter((period) => period.status === "reported")
    .reduce((total, period) => total + (period.amountArs ?? 0), 0);

  return input.findings.map((finding): EvidenceReviewItem => {
    if (finding.kind === "contradictory") {
      return {
        kind: "contradictory",
        ...(input.request ? { declaredTotal: formatArs(input.request.declaredTotalArs) } : {}),
        ...(input.request ? { reportedTotal: formatArs(reportedSum) } : {})
      };
    }
    return {
      kind: finding.kind,
      ...(finding.period !== undefined ? { periodLabel: formatPeriodLabel(finding.period) } : {}),
      ...(finding.evidenceRef !== undefined
        ? { evidence: toEvidence(finding.evidenceRef, input.registry) }
        : {})
    };
  });
}

/**
 * Derives and maps findings in one step. Without a request there is no
 * declared total to compare, so no contradictory finding (or total) is made up.
 */
export function buildReviewItems(
  request: SmeRequest | null,
  periods: readonly EvidencedPeriod[]
): readonly EvidenceReviewItem[] {
  const findings = request
    ? deriveReviewFindings(request, periods)
    : deriveReviewFindings({ declaredTotalArs: 0 }, periods).filter((f) => f.kind !== "contradictory");
  return mapFindingsToReviewItems({
    findings,
    request: request ?? undefined,
    periods,
    registry: buildEvidenceRegistry(periods)
  });
}

/**
 * The contract carries no provenance text per period, so backend data gets one
 * neutral, honest label instead of an invented per-period source.
 */
export const BACKEND_PROVENANCE = "Registro del servicio de solicitudes";

export function backendPeriodsToEvidenced(
  periods: readonly SalesPeriodContract[]
): readonly EvidencedPeriod[] {
  return periods.map((period) => ({ ...period, provenance: BACKEND_PROVENANCE }));
}

/**
 * Synthetic review shown when no backend is configured or reachable: the
 * Panadería period findings plus the contradictory fixture case, all SIMULADO.
 */
export const demoReviewItems: readonly EvidenceReviewItem[] = Object.freeze([
  ...buildReviewItems(null, panaderiaHorizonte.sales),
  ...buildReviewItems(contradictoryRequest, contradictorySalesPeriods)
]);
