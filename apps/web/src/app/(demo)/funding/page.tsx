import { StepPlaceholder } from "@/presentation/components/step-placeholder";
import { WorkspaceStatus } from "@/presentation/components/workspace-status";

export default function FundingPage() {
  return (
    <>
      <StepPlaceholder />
      <section aria-label="Wallet-connect scaffold probe">
        <p>Scaffold — pending replacement.</p>
        <WorkspaceStatus />
      </section>
    </>
  );
}
