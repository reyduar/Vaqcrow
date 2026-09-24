"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { CampaignWorkspace } from "@/presentation/components/campaign-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

/**
 * Reads and writes the campaign id in `?campaign=`, so a reload resumes the
 * same campaign instead of losing it to local-only state (no `localStorage`,
 * per the Task's own instructions). Split from the default export because
 * `useSearchParams` requires a `Suspense` boundary.
 */
function FundingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [campaignId, setCampaignId] = useState<string | null>(searchParams.get("campaign"));

  const handleCampaignOpened = useCallback(
    (id: string) => {
      setCampaignId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("campaign", id);
      router.replace(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  return <CampaignWorkspace campaignId={campaignId} onCampaignOpened={handleCampaignOpened} />;
}

export default function FundingPage() {
  return (
    <>
      <StepTrustDisclosures step="funding" />
      <Suspense fallback={null}>
        <FundingPageContent />
      </Suspense>
    </>
  );
}
