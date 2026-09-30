import { DistributionWorkspace } from "@/presentation/components/distribution-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

/**
 * The application and distribution ids live in the journey store, which the
 * demo layout hydrates from (and keeps in sync with) the URL, so `/evidence`
 * reaches the transaction hash after navigation and a reload keeps the same
 * reference.
 */
export default function DistributionPage() {
  return (
    <>
      <StepTrustDisclosures step="distribution" />
      <DistributionWorkspace />
    </>
  );
}
