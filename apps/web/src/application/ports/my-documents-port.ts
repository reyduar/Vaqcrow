import type { MyDocument } from "@vaqcrow/contracts";

/**
 * The owner-scoped read of the PyME's own uploaded documents (Feature #530,
 * T5/S4). Vendor-free and React-free: the HTTP adapter lives in
 * `infrastructure/company/`.
 *
 * The read is metadata only and its identity comes from the verified principal
 * server-side (`GET /pyme-documents/mine`, `PYME`-only), so this port never
 * carries an owner id or user id — and, deliberately, never a storage object
 * path: an `objectPath` is a server secret and must never reach a client. A
 * malformed success body is never trusted; the adapter collapses it to a
 * sanitized failure rather than rendering a partially-parsed document.
 *
 * Every failure is a sanitized code — never a provider message or a response
 * body, and never an invented empty list standing in for a failed read.
 */

/** Sanitized failure codes, mirroring the sibling owner-scoped documents read. */
export type MyDocumentsErrorCode = "unauthenticated" | "unavailable" | "network";

export type MyDocumentsResult =
  | { readonly ok: true; readonly documents: readonly MyDocument[] }
  | { readonly ok: false; readonly code: MyDocumentsErrorCode };

export interface MyDocumentsPort {
  /** The signed-in principal's own document metadata; a foreign set is never returned. */
  listMine(): Promise<MyDocumentsResult>;
}
