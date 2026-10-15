"use client";

import { useState } from "react";
import useSWR from "swr";
import type { SmeRequestRead } from "@vaqcrow/contracts";
import {
  SUBMITTED_DATA_COPY,
  submittedDataView,
  type ReadOutcome
} from "@/application/company/submitted-data";
import type { BusinessPort, BusinessRecord } from "@/application/ports/business-port";
import type { MyDocumentsPort } from "@/application/ports/my-documents-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { createBrowserBusinessPort } from "@/infrastructure/business/create-business-port";
import { createBrowserMyDocumentsPort } from "@/infrastructure/company/create-my-documents-port";
import { useMyDocuments } from "@/state/use-my-documents";
import { Button } from "../button";

/**
 * «Ver lo enviado» (Feature #530, T5/S4): the read-only, inline view of the
 * PyME's own submitted data. It shows what is persisted — the company, the
 * request with its declared sales months, and the uploaded documents' metadata —
 * and nothing else. There is no editing control and no submit; the only control
 * returns to the normal `/company` view.
 *
 * The simulated AI risk band is deliberately absent: the view-model only shapes
 * persisted records, so a simulated result has no field to travel through and
 * can never be presented as part of what was submitted (S4).
 *
 * The three reads are independent and each degrades on its own with an honest
 * per-block message, never inventing the missing rows. The owner is resolved
 * server-side from the session token; no owner id travels from here.
 */
export interface CompanySubmittedDataProps {
  /** The PyME's own application id, resolved owner-scoped by the workspace. */
  readonly applicationId: string | null;
  /** Injectable for tests; `undefined` builds the browser documents port. */
  readonly documents?: MyDocumentsPort | null;
  /** Injectable for tests; `undefined` builds the browser business port. */
  readonly business?: BusinessPort | null;
  /** The session-aware request gateway; `null` fails the request/sales blocks closed. */
  readonly smeRequestGateway?: SmeRequestGateway | null;
  readonly onClose: () => void;
}

/** The owner's own company read via `BusinessPort`; a failure is a code, never a fabricated record. */
function useMyBusiness(port: BusinessPort | null): ReadOutcome<BusinessRecord> {
  const active = port !== null;
  const { data, error, isLoading } = useSWR<BusinessRecord>(
    active ? ["company-submitted-business"] : null,
    async () => {
      const result = await (port as BusinessPort).getMyBusiness();
      if (!result.ok) throw new Error(result.code);
      return result.business;
    },
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  if (!active || error !== undefined) return { status: "failed" };
  if (isLoading || data === undefined) return { status: "loading" };
  return { status: "ok", value: data };
}

/** The owner's own request read via the session gateway; a throw (or a missing id) is a failure. */
function useMyRequest(
  gateway: SmeRequestGateway | null,
  applicationId: string | null
): ReadOutcome<SmeRequestRead> {
  const active = gateway !== null && applicationId !== null;
  const { data, error, isLoading } = useSWR<SmeRequestRead>(
    active ? ["company-submitted-request", applicationId] : null,
    ([, id]: readonly [string, string]) => (gateway as SmeRequestGateway).load(id),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  if (!active || error !== undefined) return { status: "failed" };
  if (isLoading || data === undefined) return { status: "loading" };
  return { status: "ok", value: data };
}

export function CompanySubmittedData({
  applicationId,
  documents,
  business,
  smeRequestGateway,
  onClose
}: CompanySubmittedDataProps) {
  const [documentsPort] = useState<MyDocumentsPort | null>(() =>
    documents === undefined ? createBrowserMyDocumentsPort() : documents
  );
  const [businessPort] = useState<BusinessPort | null>(() =>
    business === undefined ? createBrowserBusinessPort() : business
  );

  const businessOutcome = useMyBusiness(businessPort);
  const requestOutcome = useMyRequest(smeRequestGateway ?? null, applicationId);
  const documentsOutcome = useMyDocuments(documentsPort, true);
  const blocks = submittedDataView({
    business: businessOutcome,
    request: requestOutcome,
    documents: documentsOutcome
  });

  return (
    <section
      aria-label={SUBMITTED_DATA_COPY.regionLabel}
      lang="es"
      className="flex flex-col gap-6 rounded-card border border-border p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[680px] flex-col gap-1">
          <h1 className="m-0 text-[clamp(28px,3.4vw,40px)] leading-[1.15] font-bold tracking-[-0.03em]">
            {SUBMITTED_DATA_COPY.heading}
          </h1>
          <p className="m-0 text-[15px] leading-[1.55] text-text-secondary">{SUBMITTED_DATA_COPY.intro}</p>
        </div>
        <Button variant="ghost" onPress={onClose}>
          {SUBMITTED_DATA_COPY.close}
        </Button>
      </div>

      {blocks.map((block) => (
        <section key={block.key} aria-label={block.title} className="flex flex-col gap-2">
          <h2 className="m-0 text-[17px] leading-[1.2] font-bold tracking-[-0.01em]">{block.title}</h2>

          {block.state === "loading" ? (
            <p className="m-0 text-sm text-text-secondary">{SUBMITTED_DATA_COPY.loading}</p>
          ) : null}

          {block.state === "failed" ? (
            <p role="alert" className="m-0 text-sm font-semibold text-trust-critical">
              {block.message}
            </p>
          ) : null}

          {block.state === "ready" && block.message !== null ? (
            <p className="m-0 text-sm text-text-secondary">{block.message}</p>
          ) : null}

          {block.fields.length > 0 ? (
            <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[minmax(140px,auto)_1fr]">
              {block.fields.map((field, index) => (
                <div key={`${block.key}-${index}`} className="contents">
                  <dt className="text-sm font-semibold text-text-secondary">{field.label}</dt>
                  <dd className="m-0 text-sm text-text-primary">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      ))}
    </section>
  );
}
