import { FundingWorkspace } from "@/presentation/components/funding-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

export default function FundingPage() {
  return (
    <>
      <StepTrustDisclosures step="funding" />
      <FundingWorkspace />
    </>
  );
}
