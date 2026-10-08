"use client";

import { useState } from "react";
import type { DocumentVerdictRecord, DocumentVerdictValue } from "@vaqcrow/contracts";
import { KYC_COPY, kycEditable, kycRowsFor, kycVerdictFailureMessage, type KycRow } from "@/application/admin/kyc";
import type { AdminReviewContext, AdminReviewPort } from "@/application/ports/admin-review-port";
import type { OpenDocumentWindow } from "@/application/ports/document-window-port";

/**
 * Client state of section «1 · KYC/KYB» (Feature #410 / U3).
 *
 * The persisted verdicts come from the review context (SWR). A successful write
 * is shown at once from the API's own record and the context is re-read; that
 * local record only applies to the context it was written against, so the
 * re-read data always wins afterwards. One write at a time: every toggle is
 * disabled while a verdict is being saved, and in any state the API refuses.
 * A failure changes nothing and leaves one sanitized message.
 */

interface WrittenVerdicts {
  readonly base: readonly DocumentVerdictRecord[];
  readonly byDocument: ReadonlyMap<string, DocumentVerdictValue>;
}

export interface KycReviewState {
  readonly rows: readonly KycRow[];
  readonly editable: boolean;
  readonly saving: boolean;
  readonly openingDocumentId: string | null;
  readonly message: string | null;
  readonly setVerdict: (row: KycRow, verdict: DocumentVerdictValue) => Promise<void>;
  readonly openDocument: (row: KycRow) => Promise<void>;
}

export function useKycReview(
  port: AdminReviewPort,
  context: AdminReviewContext,
  reload: () => void,
  openWindow: OpenDocumentWindow
): KycReviewState {
  const [saving, setSaving] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [written, setWritten] = useState<WrittenVerdicts | null>(null);

  const editable = kycEditable(context.state);
  const current = written?.base === context.documentVerdicts ? written.byDocument : undefined;
  const rows = kycRowsFor(context.documents, context.documentVerdicts).map((row) => {
    const local = current?.get(row.documentId);
    return local === undefined ? row : { ...row, verdict: local };
  });

  async function setVerdict(row: KycRow, verdict: DocumentVerdictValue): Promise<void> {
    if (!editable || saving) return;
    setSaving(true);
    setMessage(null);
    const result = await port.setDocumentVerdict(context.applicationId, row.documentId, verdict);
    setSaving(false);
    if (result.ok) {
      const base = context.documentVerdicts;
      setWritten((previous) => {
        const byDocument = new Map(previous?.base === base ? previous.byDocument : []);
        byDocument.set(result.verdict.documentId, result.verdict.verdict);
        return { base, byDocument };
      });
      reload();
      return;
    }
    setMessage(kycVerdictFailureMessage(result));
    if (result.code === "state_conflict" || result.code === "not_found") reload();
  }

  async function openDocument(row: KycRow): Promise<void> {
    if (openingDocumentId !== null) return;
    const pending = openWindow({ contentType: row.contentType });
    setOpeningDocumentId(row.documentId);
    setMessage(null);
    const result = await port.downloadDocument(row.objectPath);
    setOpeningDocumentId(null);
    if (result.ok) {
      pending.show(result.file, row.subtitle);
    } else {
      pending.cancel();
      setMessage(KYC_COPY.openFailed);
    }
  }

  return { rows, editable, saving, openingDocumentId, message, setVerdict, openDocument };
}
