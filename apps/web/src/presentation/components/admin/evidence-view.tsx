"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { buildAdminEvidenceChain, EVIDENCE_COPY } from "@/application/admin/evidence";
import { ADMIN_PYMES_PATH, adminReviewPath } from "@/application/admin/review";
import type { AdminEvidencePort } from "@/application/ports/admin-review-port";
import { createBrowserAdminEvidencePort } from "@/infrastructure/admin/create-admin-review-port";
import { useAdminEvidence } from "@/state/use-admin-evidence";
import { Badge } from "../badge";
import { ErrorState } from "../error-state";
import { Skeleton } from "../skeleton";
import { AdminStatePill } from "./admin-state-pill";
import { EvidenceChain } from "./evidence-chain";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
const CRUMB_LINK = `rounded text-brand-accent-text no-underline ${FOCUS_RING}`;

export interface EvidenceViewProps {
  readonly applicationId: string;
  /** Injected in tests; production builds the browser port once. */
  readonly port?: AdminEvidencePort;
}

function Breadcrumb({ applicationId }: { applicationId: string }) {
  return (
    <nav aria-label="Ruta" className="text-[13px] text-text-secondary">
      <Link href={ADMIN_PYMES_PATH} className={CRUMB_LINK}>
        PyMEs
      </Link>{" "}
      /{" "}
      <Link href={adminReviewPath(applicationId)} className={CRUMB_LINK}>
        {EVIDENCE_COPY.backToReview}
      </Link>{" "}
      / <span aria-current="page">{EVIDENCE_COPY.breadcrumb}</span>
    </nav>
  );
}

/**
 * `/admin/pymes/[applicationId]/evidence` (#438 WU4, owner decision D3): the
 * full Testnet evidence chain of one application, reached from the PyMEs queue
 * and from the review. The header follows the review's («Evidencia: {nombre}»,
 * reference and id, state pill) and adds the TESTNET badge with the canonical
 * note that a hash proves technical execution, not an investment. Loading,
 * not-found and error states are honest; nothing is fetched beyond the
 * ADMIN-only evidence read.
 */
export function EvidenceView({ applicationId, port }: EvidenceViewProps) {
  const [resolvedPort] = useState<AdminEvidencePort>(() => port ?? createBrowserAdminEvidencePort());
  const { evidence, errorCode, reload } = useAdminEvidence(resolvedPort, applicationId);

  let body: ReactNode;
  if (evidence) {
    const chain = buildAdminEvidenceChain(evidence);
    body = (
      <>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="m-0 text-[clamp(28px,4vw,36px)] leading-[1.1] font-bold tracking-[-0.03em] break-words">
                {chain.header.title}
              </h1>
              <p className="mt-1.5 mb-0 font-mono text-[13px] break-all text-text-secondary">{chain.header.subline}</p>
            </div>
            <AdminStatePill copy={chain.header.state} size="md" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="testnet" label={EVIDENCE_COPY.testnetBadge} lang="es" />
            <p className="m-0 text-sm text-text-secondary">{chain.trustNote}</p>
          </div>
        </div>
        <EvidenceChain chain={chain} />
      </>
    );
  } else if (errorCode === "not_found") {
    body = (
      <div className="flex flex-col gap-3 rounded-panel border border-page-border bg-raised p-5 text-text-primary">
        <p className="m-0 text-sm">{EVIDENCE_COPY.notFound}</p>
        <Link
          href={ADMIN_PYMES_PATH}
          className={`inline-flex h-11 w-fit items-center rounded-control border border-control px-4 text-sm font-semibold text-text-primary no-underline hover:bg-page-surface ${FOCUS_RING}`}
        >
          {EVIDENCE_COPY.backToQueue}
        </Link>
      </div>
    );
  } else if (errorCode !== null) {
    body = <ErrorState title={EVIDENCE_COPY.loadError} message={EVIDENCE_COPY.loadErrorDetail} onRetry={reload} />;
  } else {
    body = <Skeleton shapes={["line", "card", "card", "card"]} label={EVIDENCE_COPY.loading} />;
  }

  return (
    <>
      <Breadcrumb applicationId={applicationId} />
      {body}
    </>
  );
}
