"use client";

import { DEMO_ACTOR } from "@/application/fixtures/demo-application";
import type { AssessmentGateway } from "@/application/ports/assessment-gateway";
import type { HumanDecisionGateway } from "@/application/ports/human-decision-gateway";
import type { ManualReviewGateway } from "@/application/ports/manual-review-gateway";
import { createAssessmentGateway } from "@/infrastructure/assessment/default-gateway";
import { createHumanDecisionGateway } from "@/infrastructure/decision/default-gateway";
import { createManualReviewGateway } from "@/infrastructure/manual-review/default-gateway";
import { useJourneyStore } from "@/state/journey-store-provider";
import { useHumanDecision } from "@/state/use-human-decision";
import { useManualReviewContext } from "@/state/use-manual-review-context";
import { usePersistedAssessment } from "@/state/use-persisted-assessment";
import { AiAssessmentPanel } from "./ai-assessment-panel";
import { HumanDecisionForm } from "./human-decision-form";
import { HumanDecisionRecordView } from "./human-decision-record";
import { ManualReviewContextPanel } from "./manual-review-context-panel";
import { StartWithRequestNotice } from "./start-with-request-notice";

const defaultGateway = createHumanDecisionGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);
const defaultManualReviewGateway = createManualReviewGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);
const defaultAssessmentGateway = createAssessmentGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);

export interface HumanDecisionWorkspaceProps {
  /** Injectable for tests; `undefined` uses the env-configured gateway, `null` forces "no backend". */
  readonly gateway?: HumanDecisionGateway | null;
  /** Injectable for tests; the read side of the persisted manual-review context. */
  readonly manualReviewGateway?: ManualReviewGateway | null;
  /** Injectable for tests; the read side of the persisted assessment. */
  readonly assessmentGateway?: AssessmentGateway | null;
  /** Overrides the journey application (tests); otherwise the journey's. With neither, the step asks for the request first. */
  readonly applicationId?: string;
}

/**
 * Small client container for the approval step. The AI recommendation is a
 * separate, read-only block; the form beside it is the only way to record a
 * decision, and the success view appears only after the backend confirms it.
 *
 * What the reviewer sees is what the backend persisted for the journey's
 * application, never a canned recommendation:
 * - a failed AI assessment routed to manual review leaves a persisted context,
 *   which is the truth for that flow;
 * - a recorded assessment is shown as the advisory panel;
 * - with neither, the screen says no assessment was recorded (the decision stays
 *   possible: a person can decide without an AI opinion).
 *
 * A read that failed is neither of those: the persisted record may well exist
 * but could not be read, so the screen says so instead of claiming there is none.
 */
export function HumanDecisionWorkspace({
  applicationId: applicationIdOverride,
  ...rest
}: HumanDecisionWorkspaceProps) {
  const journeyApplicationId = useJourneyStore((state) => state.applicationId);
  const applicationId = applicationIdOverride ?? journeyApplicationId;
  if (applicationId === null) return <StartWithRequestNotice action="registrar la decisión" />;
  return <HumanDecisionForApplication applicationId={applicationId} {...rest} />;
}

function HumanDecisionForApplication({
  gateway = defaultGateway,
  manualReviewGateway = defaultManualReviewGateway,
  assessmentGateway = defaultAssessmentGateway,
  applicationId
}: HumanDecisionWorkspaceProps & { readonly applicationId: string }) {
  const { submit, isSubmitting, error, recorded } = useHumanDecision(gateway, applicationId);
  const manualReview = useManualReviewContext(manualReviewGateway, applicationId);
  const assessment = usePersistedAssessment(assessmentGateway, applicationId);

  return (
    <div lang="es" className="grid items-start gap-6 lg:grid-cols-[7fr_5fr]">
      {manualReview.status === "present" ? (
        <ManualReviewContextPanel context={manualReview.context} />
      ) : manualReview.status === "unavailable" ? (
        <section
          role="alert"
          aria-label="Revisión manual no disponible"
          className="flex flex-col gap-2 rounded-card border border-border p-6"
        >
          <h3 className="m-0 text-lg font-bold tracking-[-0.01em]">Revisión manual no disponible</h3>
          <p className="m-0">
            No se pudo cargar el contexto de revisión manual persistido. Vuelva a intentar; no se
            muestra ninguna recomendación para esta solicitud.
          </p>
        </section>
      ) : manualReview.status === "loading" || assessment.status === "loading" ? (
        <p aria-live="polite" className="text-sm text-text-secondary">
          Cargando la evaluación registrada…
        </p>
      ) : assessment.status === "present" ? (
        <AiAssessmentPanel assessment={assessment.view} />
      ) : assessment.status === "unavailable" ? (
        <section
          role="alert"
          aria-label="Evaluación de IA no disponible"
          className="flex flex-col gap-2 rounded-card border border-border p-6"
        >
          <h3 className="m-0 text-lg font-bold tracking-[-0.01em]">Evaluación de IA no disponible</h3>
          <p className="m-0">No se pudo cargar la evaluación de IA registrada. Vuelva a intentar; no se muestra ninguna recomendación.</p>
        </section>
      ) : (
        <section
          aria-label="Sin evaluación de IA registrada"
          className="flex flex-col gap-2 rounded-card border border-border p-6"
        >
          <h3 className="m-0 text-lg font-bold tracking-[-0.01em]">Sin evaluación de IA</h3>
          <p className="m-0">Todavía no hay ninguna evaluación de IA registrada para esta solicitud.</p>
          <p className="m-0 text-sm text-text-secondary">La IA solo asesora: la decisión es de la persona y puede tomarse sin ella.</p>
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
