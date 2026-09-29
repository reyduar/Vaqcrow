"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { DistributionWorkspace } from "@/presentation/components/distribution-workspace";
import { StepTrustDisclosures } from "@/presentation/components/step-trust-disclosures";

/**
 * Reads and writes the distribution id in `?distribution=`, so `/evidence` can
 * reach the transaction hash after navigation and a reload keeps the same
 * reference (no `localStorage`, per the Task's own instructions and `D3`).
 * Split from the default export because `useSearchParams` requires a
 * `Suspense` boundary.
 */
function DistributionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [distributionId, setDistributionId] = useState<string | null>(
    searchParams.get("distribution")
  );

  const handleDistributionIdentified = useCallback(
    (id: string) => {
      setDistributionId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("distribution", id);
      router.replace(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <DistributionWorkspace
      distributionId={distributionId}
      onDistributionIdentified={handleDistributionIdentified}
    />
  );
}

export default function DistributionPage() {
  return (
    <>
      <StepTrustDisclosures step="distribution" />
      <Suspense fallback={null}>
        <DistributionPageContent />
      </Suspense>
    </>
  );
}
