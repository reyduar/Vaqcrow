import { EvidenceWorkspace } from "@/presentation/components/evidence-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

/**
 * The ids the journey carried live in the journey store, which the demo layout
 * hydrates from the URL (`?application=`, `?campaign=`, `?distribution=`), so
 * the dashboard shows the same run a reload or a shared link would (`D3`). The
 * page itself writes nothing.
 */
export default function EvidencePage() {
  return (
    <>
      <StepTrustDisclosures step="evidence" />
      <EvidenceWorkspace />
    </>
  );
}
