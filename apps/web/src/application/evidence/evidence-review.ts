/**
 * Pure evidence-review logic (Task #56). No React, no I/O. Missing data is
 * never completed: a missing period stays `null` and only produces a finding.
 */
import type { ReviewFinding, SmeRequest } from "@vaqcrow/contracts";

export interface EvidenceEntry {
  readonly provenance: string;
}

export type EvidenceRegistry = Readonly<Record<string, EvidenceEntry>>;

export type EvidenceResolution =
  | { readonly status: "resolved"; readonly ref: string; readonly entry: EvidenceEntry }
  | { readonly status: "unresolved"; readonly ref: string };

/** Minimal structural shape needed here; the web `SalesPeriod` satisfies it. */
export interface ReviewablePeriod {
  readonly period: string;
  readonly amountArs: number | null;
  readonly status: "reported" | "missing" | "anomalous";
  readonly evidenceRef: string;
}

export function resolveEvidenceRef(ref: string, registry: EvidenceRegistry): EvidenceResolution {
  // Own-property check so inherited keys ("constructor", "toString") never resolve.
  if (ref !== "" && Object.hasOwn(registry, ref)) {
    const entry = registry[ref];
    if (entry !== undefined) {
      return { status: "resolved", ref, entry };
    }
  }
  return { status: "unresolved", ref };
}

export function deriveReviewFindings(
  request: Pick<SmeRequest, "declaredTotalArs">,
  periods: readonly ReviewablePeriod[]
): readonly ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  for (const period of periods) {
    if (period.status === "missing" || period.status === "anomalous") {
      findings.push({
        kind: period.status,
        period: period.period,
        evidenceRef: period.evidenceRef,
        messageKey: `review.finding.${period.status}`
      });
    }
  }

  const reportedTotal = periods
    .filter((period) => period.status === "reported")
    .reduce((total, period) => total + (period.amountArs ?? 0), 0);

  if (request.declaredTotalArs !== reportedTotal) {
    findings.push({ kind: "contradictory", messageKey: "review.finding.contradictory" });
  }

  return findings;
}
