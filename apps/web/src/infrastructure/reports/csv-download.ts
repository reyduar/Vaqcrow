/**
 * Browser file/print primitives for the report export (Feature #430, WU3; owner
 * decision D2). The only impure corner of the export: it touches `document`,
 * `Blob`, `URL` and `window`, so `application/reports/export.ts` can stay a
 * pure string builder.
 *
 * No dependency, no secret: a `Blob` object URL drives a temporary, hidden
 * anchor and is revoked immediately after the click; the print action is the
 * browser's own print-to-PDF. Both entry points guard against a non-browser
 * environment so importing this module during SSR never throws.
 */

/** Path separators and characters that are unsafe in a download filename. */
const UNSAFE_FILENAME_CHARS = '\\/:*?"<>|';

/** A C0 control character or one of the reserved filename characters. */
function isUnsafeFilenameChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code < 0x20 || UNSAFE_FILENAME_CHARS.includes(char);
}

/** Keeps a filename safe for a `download` attribute; never returns an empty one. */
export function sanitizeFilename(filename: string): string {
  const sanitized = Array.from(filename, (char) => (isUnsafeFilenameChar(char) ? "-" : char)).join("").trim();
  return sanitized.length > 0 ? sanitized : "informe.csv";
}

/** Triggers a client-side CSV download of `content` as `filename`. */
export function downloadCsv(filename: string, content: string): void {
  if (typeof document === "undefined") return;

  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeFilename(filename);
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Opens the browser's print dialog (the user picks "Save as PDF"). */
export function printReport(): void {
  if (typeof window === "undefined") return;
  window.print();
}
