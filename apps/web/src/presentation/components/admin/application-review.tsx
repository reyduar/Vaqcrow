"use client";

import { useMemo, useState } from "react";
import type { AdminReviewPort } from "@/application/ports/admin-review-port";
import type { OpenDocumentWindow } from "@/application/ports/document-window-port";
import { createBrowserAdminReviewPort } from "@/infrastructure/admin/create-admin-review-port";
import { openDocumentWindow } from "@/infrastructure/admin/document-window";
import { KycSection } from "./kyc-section";
import { ReviewView, type ReviewSlots } from "./review-view";

export interface ApplicationReviewProps {
  readonly applicationId: string;
  /** Injected in tests; production builds the browser port once. */
  readonly port?: AdminReviewPort;
  /** Injected in tests; production opens a browser tab or download. */
  readonly openWindow?: OpenDocumentWindow;
}

/**
 * The admin review of one application (#410): the U2 `ReviewView` shell with
 * its sections plugged in. One port serves both the context read and the
 * section writes, so they share the signed-in session. Section 1 (KYC/KYB) is
 * U3; sections 2–3 and the deployment panel arrive with U4–U6.
 */
export function ApplicationReview({ applicationId, port, openWindow = openDocumentWindow }: ApplicationReviewProps) {
  const [resolvedPort] = useState<AdminReviewPort>(() => port ?? createBrowserAdminReviewPort());

  const slots = useMemo<ReviewSlots>(
    () => ({
      kyc: (context, reload) => (
        <KycSection context={context} reload={reload} port={resolvedPort} openWindow={openWindow} />
      )
    }),
    [resolvedPort, openWindow]
  );

  return <ReviewView applicationId={applicationId} port={resolvedPort} slots={slots} />;
}
