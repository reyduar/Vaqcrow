import { HumanDecisionWorkspace } from "@/presentation/components/human-decision-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

export default function ApprovalPage() {
  return (
    <>
      <StepTrustDisclosures step="approval" />
      <HumanDecisionWorkspace />
    </>
  );
}
