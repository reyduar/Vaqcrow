import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  validateDocumentUpload,
  type ValidateDocumentUploadInput
} from "./document-upload.js";

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]; // "%PDF-1.7\n"
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]; // FF D8 FF ...
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]; // PNG signature
const GARBAGE = [0x7b, 0x22, 0x6e, 0x6f, 0x74, 0x22, 0x3a, 0x31, 0x7d]; // {"not":1}

const USER_ID = "c1111111-1111-4111-8111-111111111111";
const OBJECT_ID = "99999999-9999-4999-8999-999999999999";

function input(overrides: Partial<ValidateDocumentUploadInput> = {}): ValidateDocumentUploadInput {
  return {
    userId: USER_ID,
    kind: "cuit",
    filename: "cuit.pdf",
    contentType: "application/pdf",
    bytes: Uint8Array.from(PDF),
    generateId: () => OBJECT_ID,
    ...overrides
  };
}

describe("validateDocumentUpload", () => {
  it("accepts a PDF declared as application/pdf and builds the owner path", () => {
    const result = validateDocumentUpload(input());

    expect(result).toEqual({
      ok: true,
      value: {
        path: `${USER_ID}/cuit/${OBJECT_ID}-cuit.pdf`,
        kind: "cuit",
        name: "cuit.pdf",
        size: PDF.length,
        contentType: "application/pdf"
      }
    });
  });

  it("accepts a JPEG by its magic bytes", () => {
    const result = validateDocumentUpload(
      input({ contentType: "image/jpeg", filename: "photo.jpg", bytes: Uint8Array.from(JPEG) })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contentType).toBe("image/jpeg");
      expect(result.value.path).toBe(`${USER_ID}/cuit/${OBJECT_ID}-photo.jpg`);
    }
  });

  it("accepts a PNG by its magic bytes", () => {
    const result = validateDocumentUpload(
      input({ contentType: "image/png", filename: "shot.png", bytes: Uint8Array.from(PNG), kind: "photo" })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contentType).toBe("image/png");
      expect(result.value.kind).toBe("photo");
    }
  });

  it("sanitizes a hostile filename and keeps a safe extension", () => {
    const result = validateDocumentUpload(
      input({ filename: "../../My Report (final)!.pdf" })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("My-Report-final.pdf");
      expect(result.value.path).not.toContain("..");
      expect(result.value.path.split("/")[0]).toBe(USER_ID);
    }
  });

  it("appends the canonical extension when the filename has none", () => {
    const result = validateDocumentUpload(input({ filename: "cuit" }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("cuit.pdf");
    }
  });

  it("bounds a very long filename", () => {
    const result = validateDocumentUpload(input({ filename: `${"a".repeat(500)}.pdf` }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name.length).toBeLessThanOrEqual(80);
      expect(result.value.name.endsWith(".pdf")).toBe(true);
    }
  });

  it("rejects a declared type outside the allow-list", () => {
    expect(
      validateDocumentUpload(input({ contentType: "text/plain", filename: "notes.txt" }))
    ).toEqual({ ok: false, code: "unsupported_type" });
  });

  it("rejects content whose magic bytes do not match the declared type", () => {
    expect(
      validateDocumentUpload(input({ contentType: "application/pdf", bytes: Uint8Array.from(JPEG) }))
    ).toEqual({ ok: false, code: "unsupported_type" });
  });

  it("rejects content whose magic bytes are not an allowed format", () => {
    expect(validateDocumentUpload(input({ bytes: Uint8Array.from(GARBAGE) }))).toEqual({
      ok: false,
      code: "unsupported_type"
    });
  });

  it("rejects empty bytes", () => {
    expect(validateDocumentUpload(input({ bytes: new Uint8Array() }))).toEqual({
      ok: false,
      code: "unsupported_type"
    });
  });

  it("rejects content larger than the 10 MB cap", () => {
    const oversize = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    oversize.set(PDF);

    expect(validateDocumentUpload(input({ bytes: oversize }))).toEqual({ ok: false, code: "too_large" });
  });

  it("accepts content exactly at the 10 MB cap", () => {
    const atCap = new Uint8Array(MAX_UPLOAD_BYTES);
    atCap.set(PDF);

    expect(validateDocumentUpload(input({ bytes: atCap })).ok).toBe(true);
  });

  it("rejects a filename with no usable characters", () => {
    expect(validateDocumentUpload(input({ filename: "../../" }))).toEqual({
      ok: false,
      code: "invalid_name"
    });
  });

  it("rejects an unknown document kind", () => {
    expect(validateDocumentUpload(input({ kind: "passport" }))).toEqual({
      ok: false,
      code: "invalid_kind"
    });
  });
});
