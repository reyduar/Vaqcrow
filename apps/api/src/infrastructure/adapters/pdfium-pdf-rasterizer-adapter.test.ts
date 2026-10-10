import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createPdfiumPdfRasterizerAdapter } from "./pdfium-pdf-rasterizer-adapter.js";

/**
 * Committed fixtures, both generated deterministically (no toolchain):
 * - `sample.pdf` — one 300x300 pt page with a line of Helvetica text.
 * - `large-page.pdf` — one 5000x800 pt page, to exercise the render cap.
 */
function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(`../../test/fixtures/${name}`, import.meta.url))));
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Mirrors the adapter's documented cap; the vision model downscales anyway. */
const MAX_OUTPUT_DIMENSION = 1600;
/** Mirrors the upload cap the API enforces before the rasterizer sees bytes. */
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

function pngSize(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe("createPdfiumPdfRasterizerAdapter", () => {
  it("rasterizes the first page to PNG bytes", async () => {
    const adapter = createPdfiumPdfRasterizerAdapter();

    const result = await adapter.rasterize({ bytes: fixture("sample.pdf") });

    if (!result.ok) {
      throw new Error(`expected the fixture to rasterize, got ${result.error.code}`);
    }
    expect(result.value.contentType).toBe("image/png");
    expect(Array.from(result.value.bytes.subarray(0, 8))).toEqual(PNG_SIGNATURE);
    const { width, height } = pngSize(result.value.bytes);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(Math.max(width, height)).toBeLessThanOrEqual(MAX_OUTPUT_DIMENSION);
  });

  it("caps the rendered size of an oversized page", async () => {
    const adapter = createPdfiumPdfRasterizerAdapter();

    const result = await adapter.rasterize({ bytes: fixture("large-page.pdf") });

    if (!result.ok) {
      throw new Error(`expected the fixture to rasterize, got ${result.error.code}`);
    }
    const { width, height } = pngSize(result.value.bytes);
    expect(Math.max(width, height)).toBe(MAX_OUTPUT_DIMENSION);
  });

  it("maps bytes that are not a PDF to invalid_pdf", async () => {
    const adapter = createPdfiumPdfRasterizerAdapter();

    const result = await adapter.rasterize({ bytes: new TextEncoder().encode("not a pdf at all") });

    expect(result).toEqual({ ok: false, error: { code: "invalid_pdf" } });
  });

  it("maps a non-PDF image to invalid_pdf", async () => {
    const adapter = createPdfiumPdfRasterizerAdapter();

    const result = await adapter.rasterize({ bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]) });

    expect(result).toEqual({ ok: false, error: { code: "invalid_pdf" } });
  });

  it("maps a corrupt PDF to invalid_pdf", async () => {
    const adapter = createPdfiumPdfRasterizerAdapter();

    const result = await adapter.rasterize({
      bytes: new TextEncoder().encode("%PDF-1.7\ngarbage that is not a document")
    });

    expect(result).toEqual({ ok: false, error: { code: "invalid_pdf" } });
  });

  it("maps an empty input to invalid_pdf", async () => {
    const adapter = createPdfiumPdfRasterizerAdapter();

    const result = await adapter.rasterize({ bytes: new Uint8Array(0) });

    expect(result).toEqual({ ok: false, error: { code: "invalid_pdf" } });
  });

  it("rejects an input larger than the upload cap before rendering", async () => {
    const adapter = createPdfiumPdfRasterizerAdapter();

    const result = await adapter.rasterize({ bytes: new Uint8Array(MAX_INPUT_BYTES + 1) });

    expect(result).toEqual({ ok: false, error: { code: "invalid_pdf" } });
  });
});
