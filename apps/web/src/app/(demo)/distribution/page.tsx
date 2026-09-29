import { DistributionWorkspace } from "@/presentation/components/distribution-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

export default function DistributionPage() {
  return (
    <>
      <StepTrustDisclosures step="distribution" />
      <DistributionWorkspace />
    </>
  );
}
