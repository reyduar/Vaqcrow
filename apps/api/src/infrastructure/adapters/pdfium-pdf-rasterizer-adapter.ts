import { PDFiumLibrary, type PDFiumDocument } from "@hyzyla/pdfium";
import type {
  PdfRasterizeInput,
  PdfRasterizeResult,
  PdfRasterizerPort
} from "../../application/ports/pdf-rasterizer-port.js";
import { encodePng } from "./png-encoder.js";

/**
 * PDFium (WASM) implementation of `PdfRasterizerPort` (content-relevance/vision U4).
 *
 * Library choice and the tradeoff weighed — `@hyzyla/pdfium`, pinned 2.1.13:
 * - **Pure WASM, no native build.** PDFium (the engine Chrome ships) compiled to
 *   WebAssembly; no `node-gyp`, no `canvas`, no per-platform binary — decision D6.
 * - **Permissive licence.** The wrapper is MIT and PDFium is BSD-3-Clause, so it
 *   does not pull AGPL-3.0 into the dependency tree. The other zero-native
 *   candidate, `mupdf@1.28.1`, renders PNG directly but is AGPL-3.0-or-later.
 * - **Cost of that choice.** PDFium hands back a raw RGBA bitmap, so the PNG
 *   encoding is the small internal `png-encoder.ts` built on Node's `node:zlib`
 *   rather than a second dependency (its own README reaches for native `sharp`).
 * - **Bundle/cold start.** ~11 MB unpacked WASM, resolved from `node_modules` at
 *   runtime (the `tsc` build does not bundle it). Instantiation is the cold-start
 *   cost and is paid once per process: the library is a module-level singleton.
 *
 * The render is bounded: the longest output side never exceeds
 * `MAX_OUTPUT_DIMENSION` px, so a 10 MB PDF cannot produce an unbounded bitmap.
 * Engine messages never cross the port boundary — only a sanitized code does.
 */

/** Matches the upload cap in `document-upload.ts`; anything larger is refused before the engine sees it. */
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
/** Longest output side in pixels. The vision model downscales, so a larger raster only wastes memory. */
const MAX_OUTPUT_DIMENSION = 1600;
/** Preferred density: 2x the PDF point grid (~144 DPI), reduced to honour the cap above. */
const DEFAULT_SCALE = 2;

let libraryPromise: Promise<PDFiumLibrary> | null = null;

function loadLibrary(): Promise<PDFiumLibrary> {
  if (libraryPromise === null) {
    libraryPromise = PDFiumLibrary.init().catch((cause: unknown) => {
      libraryPromise = null; // never cache a failed init; a later call may retry
      throw cause;
    });
  }
  return libraryPromise;
}

function scaleFor(pageWidth: number, pageHeight: number): number {
  const longestSide = Math.max(pageWidth, pageHeight);
  if (!(longestSide > 0)) {
    return 0;
  }
  return Math.min(DEFAULT_SCALE, MAX_OUTPUT_DIMENSION / longestSide);
}

export function createPdfiumPdfRasterizerAdapter(): PdfRasterizerPort {
  return {
    async rasterize(input: PdfRasterizeInput): Promise<PdfRasterizeResult> {
      if (input.bytes.length === 0 || input.bytes.length > MAX_INPUT_BYTES) {
        return { ok: false, error: { code: "invalid_pdf" } };
      }

      let library: PDFiumLibrary;
      try {
        library = await loadLibrary();
      } catch {
        return { ok: false, error: { code: "unavailable" } };
      }

      let document: PDFiumDocument | null = null;
      try {
        document = await library.loadDocument(input.bytes);
        if (document.getPageCount() < 1) {
          return { ok: false, error: { code: "invalid_pdf" } };
        }

        const page = document.getPage(0);
        const { originalWidth, originalHeight } = page.getOriginalSize();
        const scale = scaleFor(originalWidth, originalHeight);
        if (!(scale > 0)) {
          return { ok: false, error: { code: "invalid_pdf" } };
        }

        const rendered = await page.render({ render: "bitmap", scale });
        const png = encodePng(rendered.data, rendered.width, rendered.height);
        return { ok: true, value: { bytes: png, contentType: "image/png" } };
      } catch {
        // The engine's message is deliberately dropped: a malformed document is
        // the only thing this branch can mean to a caller.
        return { ok: false, error: { code: "invalid_pdf" } };
      } finally {
        document?.destroy();
      }
    }
  };
}
