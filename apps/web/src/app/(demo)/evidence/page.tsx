"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EvidenceWorkspace } from "@/presentation/components/evidence-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

/**
 * Reads the two ids the journey carried in the URL (`?campaign=` and
 * `?distribution=`, written by the funding and distribution steps) and hands
 * them to the workspace, so the dashboard shows the same run a reload would
 * (`D3`). Split from the default export because `useSearchParams` requires a
 * `Suspense` boundary; the page itself writes nothing to the URL.
 */
function EvidencePageContent() {
  const searchParams = useSearchParams();

  return (
    <EvidenceWorkspace
      campaignId={searchParams.get("campaign")}
      distributionId={searchParams.get("distribution")}
    />
  );
}

export default function EvidencePage() {
  return (
    <>
      <StepTrustDisclosures step="evidence" />
      <Suspense fallback={null}>
        <EvidencePageContent />
      </Suspense>
    </>
  );
}
