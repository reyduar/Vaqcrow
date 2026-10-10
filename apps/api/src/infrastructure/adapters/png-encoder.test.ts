import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { encodePng } from "./png-encoder.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface PngChunk {
  readonly type: string;
  readonly data: Uint8Array;
}

function readChunks(png: Uint8Array): PngChunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: PngChunk[] = [];
  let offset = 8;
  while (offset + 8 <= png.length) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

function uint32be(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}

/** A 2x2 RGBA image: red, green / blue, white. */
const PIXELS = Uint8Array.from([
  255, 0, 0, 255,
  0, 255, 0, 255,
  0, 0, 255, 255,
  255, 255, 255, 255
]);

describe("encodePng", () => {
  it("starts with the PNG signature", () => {
    const png = encodePng(PIXELS, 2, 2);

    expect(Array.from(png.subarray(0, 8))).toEqual(PNG_SIGNATURE);
  });

  it("writes an 8-bit RGBA image header for the given dimensions", () => {
    const png = encodePng(PIXELS, 2, 2);
    const chunks = readChunks(png);
    const ihdr = chunks.find((chunk) => chunk.type === "IHDR");

    expect(ihdr).toBeDefined();
    expect(uint32be(ihdr?.data ?? new Uint8Array(), 0)).toBe(2);
    expect(uint32be(ihdr?.data ?? new Uint8Array(), 4)).toBe(2);
    // bit depth 8, color type 6 (truecolour with alpha), deflate, adaptive, no interlace
    expect(Array.from(ihdr?.data.slice(8) ?? [])).toEqual([8, 6, 0, 0, 0]);
  });

  it("stores unfiltered scanlines that inflate back to the source pixels", () => {
    const png = encodePng(PIXELS, 2, 2);
    const chunks = readChunks(png);
    const idat = chunks.find((chunk) => chunk.type === "IDAT");

    expect(idat).toBeDefined();
    const raw = new Uint8Array(inflateSync(idat?.data ?? new Uint8Array()));

    // One filter byte (0 = none) per scanline, then the row's RGBA bytes.
    expect(raw.length).toBe((2 * 4 + 1) * 2);
    expect(raw[0]).toBe(0);
    expect(Array.from(raw.slice(1, 9))).toEqual(Array.from(PIXELS.slice(0, 8)));
    expect(raw[9]).toBe(0);
    expect(Array.from(raw.slice(10, 18))).toEqual(Array.from(PIXELS.slice(8, 16)));
  });

  it("terminates with an IEND chunk", () => {
    const chunks = readChunks(encodePng(PIXELS, 2, 2));

    expect(chunks.at(-1)?.type).toBe("IEND");
    expect(chunks.at(-1)?.data.length).toBe(0);
  });

  it("rejects a pixel buffer that does not match the dimensions", () => {
    expect(() => encodePng(PIXELS, 3, 3)).toThrow();
  });
});
