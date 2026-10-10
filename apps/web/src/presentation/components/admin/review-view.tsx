"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { IoGitNetworkOutline } from "react-icons/io5";
import { EVIDENCE_COPY } from "@/application/admin/evidence";
import { ADMIN_PYMES_PATH, adminEvidencePath, reviewHeaderFor } from "@/application/admin/review";
import type { AdminReviewContext, AdminReviewPort } from "@/application/ports/admin-review-port";
import { createBrowserAdminReviewPort } from "@/infrastructure/admin/create-admin-review-port";
import { useAdminReview } from "@/state/use-admin-review";
import { AdminStatePill } from "./admin-state-pill";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

/** One review section, rendered from the loaded context; `reload` re-reads it after a write. */
export type ReviewSlot = (context: AdminReviewContext, reload: () => void) => ReactNode;

/**
 * The template's regions: sections 1 (KYC/KYB) and 2 (AI recommendation) in the
 * wide column, section 3 (human decision) and the deployment panel in the
 * narrow one. Each is filled by its own work unit (U3–U6); an absent slot
 * renders nothing, never placeholder content.
 */
export interface ReviewSlots {
  readonly kyc?: ReviewSlot;
  readonly assessment?: ReviewSlot;
  readonly decision?: ReviewSlot;
  readonly deployment?: ReviewSlot;
}

export interface ReviewViewProps {
  readonly applicationId: string;
  /** Injected in tests; production builds the browser port once. */
  readonly port?: AdminReviewPort;
  readonly slots?: ReviewSlots;
}

function Breadcrumb() {
  return (
    <nav aria-label="Ruta" className="text-[13px] text-text-secondary">
      <Link href={ADMIN_PYMES_PATH} className={`rounded text-brand-accent-text no-underline ${FOCUS_RING}`}>
        PyMEs
      </Link>{" "}
      / Revisión
    </nav>
  );
}

/**
 * `/admin/pymes/[applicationId]`: the review view of `Vaqcrow Admin.dc.html`
 * (view `review`). This shell owns the breadcrumb, the «Revisión: {nombre}»
 * header with its state badge, and the honest loading, not-found and error
 * states; the sections plug in through `slots`.
 */
export function ReviewView({ applicationId, port, slots = {} }: ReviewViewProps) {
  const [resolvedPort] = useState<AdminReviewPort>(() => port ?? createBrowserAdminReviewPort());
  const { context, isLoading, errorCode, reload } = useAdminReview(resolvedPort, applicationId);

  let body: ReactNode;
  if (context) {
    const header = reviewHeaderFor(context);
    body = (
      <>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 text-[clamp(28px,4vw,36px)] leading-[1.1] font-bold tracking-[-0.03em]">
              {header.title}
            </h1>
            <p className="mt-1.5 mb-0 text-text-secondary">{header.subline}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={adminEvidencePath(context.applicationId)}
              className={`inline-flex h-11 items-center gap-2 rounded-control border border-control px-4 text-sm font-semibold text-text-primary no-underline hover:bg-page-surface ${FOCUS_RING}`}
            >
              <IoGitNetworkOutline aria-hidden="true" focusable="false" className="text-base text-brand-accent-text" />
              {EVIDENCE_COPY.reviewLinkLabel}
            </Link>
            <AdminStatePill copy={header.state} size="md" />
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
            {slots.kyc?.(context, reload)}
            {slots.assessment?.(context, reload)}
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
            {slots.decision?.(context, reload)}
            {slots.deployment?.(context, reload)}
          </div>
        </div>
      </>
    );
  } else if (errorCode === "not_found") {
    body = (
      <div className="rounded-panel border border-page-border bg-raised p-5 text-text-primary">
        <p className="m-0 text-sm">No encontramos esta solicitud.</p>
      </div>
    );
  } else if (errorCode !== null) {
    body = (
      <div role="alert" className="flex flex-col gap-3 rounded-panel border border-page-border bg-raised p-5 text-text-primary">
        <p className="m-0 text-sm">No pudimos cargar la solicitud. No se modificó ningún dato.</p>
        <button
          type="button"
          onClick={reload}
          className={`h-11 w-fit rounded-control border border-control px-4 text-sm font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
        >
          Reintentar
        </button>
      </div>
    );
  } else {
    body = (
      <p role="status" aria-busy={isLoading ? "true" : undefined} className="m-0 text-sm text-text-secondary">
        Cargando…
      </p>
    );
  }

  return (
    <>
      <Breadcrumb />
      {body}
    </>
  );
}
