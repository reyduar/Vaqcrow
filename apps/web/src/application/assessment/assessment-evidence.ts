import type { ReviewFinding, SalesPeriodContract } from "@vaqcrow/contracts";
import type { SalesPeriod } from "@/application/fixtures/panaderia-horizonte";
import type { AssessmentEvidence } from "@/application/ports/assessment-gateway";

/**
 * Projects the demo's synthetic sales history into the evidence the API accepts.
 *
 * This projection is not cosmetic. The fixture carries fields the model's
 * evidence contract does not declare — `label` for the screen, `provenance` for
 * the audit trail, an optional `note` — and `salesPeriodSchema` is a strict
 * object, so sending the fixture as-is would be refused at the boundary. The
 * five fields below are exactly what the contract declares, and nothing else
 * crosses.
 *
 * The reference is carried through untouched: it is the one string the model may
 * cite, and the guardrail on the other side checks every citation against it.
 */
export function toAssessmentEvidence(
  sales: readonly SalesPeriod[],
  findings: readonly ReviewFinding[] = []
): AssessmentEvidence {
  const periods: readonly SalesPeriodContract[] = sales.map((entry) => ({
    period: entry.period,
    amountArs: entry.amountArs,
    status: entry.status,
    evidenceRef: entry.evidenceRef,
    simuladoLabel: entry.simuladoLabel
  }));

  return { periods, findings };
}
