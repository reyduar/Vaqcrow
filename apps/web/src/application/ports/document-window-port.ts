/**
 * Displays a private document the admin downloaded (Feature #410 / D1, U3).
 * Vendor-free and React-free; the browser adapter lives in
 * `infrastructure/admin/document-window.ts`.
 */

export interface PendingDocumentWindow {
  /** Displays the downloaded bytes, then releases them. */
  show(blob: Blob, name: string): void;
  /** Gives up: closes anything prepared for the document. */
  cancel(): void;
}

/** Called synchronously on the click, before the download starts. */
export type OpenDocumentWindow = (document: { readonly contentType: string }) => PendingDocumentWindow;
