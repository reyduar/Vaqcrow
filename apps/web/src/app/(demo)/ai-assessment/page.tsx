import { simulatedAssessment } from "@/application/assessment/simulated-assessment";
import { microcopy } from "@/application/trust/disclosures";
import { AiAssessmentPanel } from "@/presentation/components/ai-assessment-panel";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";
import { TrustBanner } from "@/presentation/components/trust-banner";

export default function AiAssessmentPage() {
  return (
    <>
      <StepTrustDisclosures step="ai-assessment" />
      <TrustBanner
        variant="fallback"
        title="Respuesta de respaldo"
        body={microcopy.aiFallback}
        badge={{ variant: "fallback", label: "RESPUESTA DE RESPALDO" }}
        lang="es"
      />
      <AiAssessmentPanel assessment={simulatedAssessment} />
    </>
  );
}
