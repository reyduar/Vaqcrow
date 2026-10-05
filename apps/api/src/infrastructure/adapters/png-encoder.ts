import { deflateSync } from "node:zlib";

/**
 * Minimal PNG encoder for raw RGBA pixels (content-relevance/vision feature U4).
 *
 * The chosen PDF engine (`@hyzyla/pdfium`) renders a page to a raw RGBA buffer
 * but ships no image encoder — its own README points at `sharp`, which is a
 * native build and is exactly what decision D6 forbids. Encoding a lossless
 * PNG is small and fully specified, so it lives here on top of Node's built-in
 * `node:zlib` instead of adding a second native or third-party dependency.
 *
 * Output is a single 8-bit truecolour-with-alpha image, unfiltered scanlines
 * (filter 0) and one IDAT chunk. The vision provider downscales the result, so
 * filter heuristics only buy bytes we do not need.
 */

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BIT_DEPTH = 8;
const RGBA_COLOR_TYPE = 6;
const UNFILTERED = 0;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    const index = (crc ^ byte) & 0xff;
    crc = (CRC_TABLE[index] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32bigEndian(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, false);
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);

  const out = new Uint8Array(4 + body.length + 4);
  out.set(uint32bigEndian(data.length), 0);
  out.set(body, 4);
  out.set(uint32bigEndian(crc32(body)), 4 + body.length);
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Encodes `rgba` (4 bytes per pixel, row-major) as a PNG of `width` x `height`.
 * Throws on a buffer/size mismatch: that is an internal invariant, never user
 * input, and the adapter that calls it owns the sanitized port error.
 */
export function encodePng(rgba: Uint8Array, width: number, height: number): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("encodePng: width and height must be positive integers");
  }
  if (rgba.length !== width * height * 4) {
    throw new Error("encodePng: rgba buffer does not match width * height * 4");
  }

  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = UNFILTERED;
    raw.set(rgba.subarray(y * stride, y * stride + stride), rowStart + 1);
  }

  const ihdr = new Uint8Array(13);
  ihdr.set(uint32bigEndian(width), 0);
  ihdr.set(uint32bigEndian(height), 4);
  ihdr[8] = BIT_DEPTH;
  ihdr[9] = RGBA_COLOR_TYPE;

  return concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array(0))
  ]);
}
