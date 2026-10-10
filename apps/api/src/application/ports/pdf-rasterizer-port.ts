/**
 * Vendor-free PDF→image rasterizer port (content-relevance/vision feature U4).
 *
 * The vision provider accepts images only (webp/png/jpeg/gif) and rejects
 * `application/pdf`, so the content-relevance check (U5) rasterizes a document's
 * **first page** before sending it to the model. This port names neither the PDF
 * engine nor its SDK: the concrete implementation lives in
 * `infrastructure/adapters/pdfium-pdf-rasterizer-adapter.ts`.
 *
 * The port result uses the repository's sanitized-result shape: a caller sees a
 * code (`invalid_pdf` for bytes that are not a readable document — including an
 * empty or oversized input — and `unavailable` when the rasterizer engine itself
 * cannot run), never a provider message. The engine's own errors are never
 * allowed to cross this boundary.
 *
 * The production adapter bounds the rendered raster: the longest output side is
 * capped at 1600 px regardless of the page size, so a 10 MB PDF cannot fan out
 * into a giant bitmap. The vision model downscales the image anyway, so the cap
 * only trades bytes we would discard for a bounded, predictable memory profile.
 *
 * Engine choice (evaluated against decision D6, "pure JS/WASM, no native build"):
 * - `@hyzyla/pdfium@2.1.13` — **chosen.** PDFium (Chrome's engine) as WASM, MIT
 *   wrapper over BSD-3-Clause PDFium. ~11 MB unpacked, instantiated once per
 *   process (the cold-start cost), community-maintained but active and widely
 *   used. It returns a raw RGBA buffer, so the adapter encodes PNG itself.
 * - `mupdf@1.28.1` — renders PNG directly and is officially maintained by
 *   Artifex, ~14 MB unpacked, but is AGPL-3.0-or-later; rejected rather than
 *   pull a copyleft licence into the product's dependency tree.
 * - `pdf-to-img@7` — rejected: it pulls the native `@napi-rs/canvas` binary,
 *   which D6 forbids and which would not survive the `tsc`-only API build.
 */

export type PdfRasterizeErrorCode = "invalid_pdf" | "unavailable";

export interface PdfRasterizeError {
  readonly code: PdfRasterizeErrorCode;
}

export interface PdfRasterizedImage {
  readonly bytes: Uint8Array;
  /** One of the image types the vision provider accepts; the adapter emits `image/png`. */
  readonly contentType: string;
}

export type PdfRasterizeResult =
  | { readonly ok: true; readonly value: PdfRasterizedImage }
  | { readonly ok: false; readonly error: PdfRasterizeError };

export interface PdfRasterizeInput {
  readonly bytes: Uint8Array;
}

export interface PdfRasterizerPort {
  /**
   * Renders the first page of `bytes` to an accepted image. A PDF with zero
   * pages, a corrupt document or a non-PDF input is `invalid_pdf`; a failure of
   * the rasterizer engine itself is `unavailable`.
   */
  rasterize(input: PdfRasterizeInput): Promise<PdfRasterizeResult>;
}
