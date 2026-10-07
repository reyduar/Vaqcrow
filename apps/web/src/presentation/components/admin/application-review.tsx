"use client";

import { useMemo, useState } from "react";
import type { AdminReviewPort } from "@/application/ports/admin-review-port";
import type { OpenDocumentWindow } from "@/application/ports/document-window-port";
import { createBrowserAdminReviewPort } from "@/infrastructure/admin/create-admin-review-port";
import { openDocumentWindow } from "@/infrastructure/admin/document-window";
import { useOptionalDisplayName } from "@/state/session-store-provider";
import { AssessmentSection } from "./assessment-section";
import { DecisionSection } from "./decision-section";
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
 * U3, section 2 (AI recommendation) U4 and section 3 (human decision) U5; the
 * deployment panel arrives with U6. The signed-in admin's display name only
 * phrases the confirmation: the recorded actor always comes from the server.
 */
export function ApplicationReview({ applicationId, port, openWindow = openDocumentWindow }: ApplicationReviewProps) {
  const [resolvedPort] = useState<AdminReviewPort>(() => port ?? createBrowserAdminReviewPort());
  const adminName = useOptionalDisplayName();

  const slots = useMemo<ReviewSlots>(
    () => ({
      kyc: (context, reload) => (
        <KycSection context={context} reload={reload} port={resolvedPort} openWindow={openWindow} />
      ),
      assessment: (context) => <AssessmentSection context={context} />,
      decision: (context, reload) => (
        <DecisionSection context={context} reload={reload} port={resolvedPort} adminName={adminName} />
      )
    }),
    [resolvedPort, openWindow, adminName]
  );

  return <ReviewView applicationId={applicationId} port={resolvedPort} slots={slots} />;
}
