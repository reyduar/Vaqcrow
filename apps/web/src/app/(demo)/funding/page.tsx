import { CampaignWorkspace } from "@/presentation/components/campaign-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

/**
 * The application and campaign ids come from the journey store, which the demo
 * layout hydrates from (and keeps in sync with) the URL, so a reload resumes the
 * same campaign.
 */
export default function FundingPage() {
  return (
    <>
      <StepTrustDisclosures step="funding" />
      <CampaignWorkspace />
    </>
  );
}
