import { AssessmentWorkspace } from "@/presentation/components/assessment-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

/**
 * The assessment step of the demo journey.
 *
 * It used to render a frozen fixture with a permanent "respuesta de respaldo"
 * banner. The real path now exists — the backend evaluates the evidence with a
 * real model — so the banner moved to where it belongs: the failure state, shown
 * by the workspace only when there is genuinely no assessment to display.
 */
export default function AiAssessmentPage() {
  return (
    <>
      <StepTrustDisclosures step="ai-assessment" />
      <AssessmentWorkspace />
    </>
  );
}
