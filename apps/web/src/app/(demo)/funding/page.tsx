import { StepPlaceholder } from "@/presentation/components/step-placeholder";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";
import { WorkspaceStatus } from "@/presentation/components/workspace-status";

export default function FundingPage() {
  return (
    <>
      <StepTrustDisclosures step="funding" />
      <StepPlaceholder />
      <section aria-label="Wallet-connect scaffold probe">
        <p>Scaffold — pending replacement.</p>
        <WorkspaceStatus />
      </section>
    </>
  );
}
