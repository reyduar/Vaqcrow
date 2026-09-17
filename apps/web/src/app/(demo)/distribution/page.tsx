import { StepPlaceholder } from "@/presentation/components/step-placeholder";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

export default function DistributionPage() {
  return (
    <>
      <StepTrustDisclosures step="distribution" />
      <StepPlaceholder />
    </>
  );
}
