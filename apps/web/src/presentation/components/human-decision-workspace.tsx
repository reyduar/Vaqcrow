"use client";

import { simulatedAssessment } from "@/application/assessment/simulated-assessment";
import { DEMO_ACTOR, DEMO_APPLICATION_ID } from "@/application/fixtures/demo-application";
import type { HumanDecisionGateway } from "@/application/ports/human-decision-gateway";
import type { ManualReviewGateway } from "@/application/ports/manual-review-gateway";
import { createHumanDecisionGateway } from "@/infrastructure/decision/default-gateway";
import { createManualReviewGateway } from "@/infrastructure/manual-review/default-gateway";
import { useHumanDecision } from "@/state/use-human-decision";
import { useManualReviewContext } from "@/state/use-manual-review-context";
import { RECOMMENDATION_LABEL, riskLabel } from "./ai-assessment-panel";
import { Badge } from "./badge";
import { HumanDecisionForm } from "./human-decision-form";
import { HumanDecisionRecordView } from "./human-decision-record";
import { ManualReviewContextPanel } from "./manual-review-context-panel";

const defaultGateway = createHumanDecisionGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);
const defaultManualReviewGateway = createManualReviewGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);

export interface HumanDecisionWorkspaceProps {
  /** Injectable for tests; `undefined` uses the env-configured gateway, `null` forces "no backend". */
  readonly gateway?: HumanDecisionGateway | null;
  /** Injectable for tests; the read side of the persisted manual-review context. */
  readonly manualReviewGateway?: ManualReviewGateway | null;
  readonly applicationId?: string;
}

/**
 * Small client container for the approval step. The AI recommendation is a
 * separate, read-only block; the form below it is the only way to record a
 * decision, and the success view appears only after the backend confirms it.
 *
 * When a failed AI assessment was routed to manual review, the backend holds a
 * persisted context for this application. That context is the truth for the
 * failure flow, so it replaces the disconnected simulated recommendation; the
 * fixture stays for the unrelated flow where no handoff exists.
 */
export function HumanDecisionWorkspace({
  gateway = defaultGateway,
  manualReviewGateway = defaultManualReviewGateway,
  applicationId = DEMO_APPLICATION_ID
}: HumanDecisionWorkspaceProps) {
  const { submit, isSubmitting, error, recorded } = useHumanDecision(gateway, applicationId);
  const manualReview = useManualReviewContext(manualReviewGateway, applicationId);

  return (
    <div lang="es" className="grid gap-6 md:grid-cols-2">
      {manualReview.status === "present" ? (
        <ManualReviewContextPanel context={manualReview.context} />
      ) : (
        <section aria-label="Recomendación de IA (simulada, solo asesora)" className="flex flex-col gap-2">
          <header className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">Recomendación de IA</h3>
            <Badge variant="simulado" label={simulatedAssessment.simuladoLabel} lang="es" />
          </header>
          <p>
            {riskLabel(simulatedAssessment.riskBand)}, {simulatedAssessment.confidencePercent} % de confianza:{" "}
            {RECOMMENDATION_LABEL[simulatedAssessment.recommendation].toLowerCase()}.
          </p>
          <p className="text-sm text-muted">Solo asesora. No decide ni sustituye la decisión de la persona.</p>
        </section>
      )}

      {recorded ? (
        <HumanDecisionRecordView recorded={recorded} />
      ) : (
        <HumanDecisionForm
          defaultActor={DEMO_ACTOR}
          onSubmit={submit}
          isSubmitting={isSubmitting}
          {...(error ? { error } : {})}
        />
      )}
    </div>
  );
}
