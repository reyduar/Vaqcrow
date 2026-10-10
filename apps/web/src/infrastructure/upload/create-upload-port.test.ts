import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserUploadPort, createUploadPort, UNAVAILABLE_UPLOAD_PORT } from "./create-upload-port";
import { HttpUploadAdapter } from "./http-upload-adapter";

function file(): File {
  return new File([new Uint8Array([1, 2, 3])], "cuit.pdf", { type: "application/pdf" });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createUploadPort", () => {
  it("returns null for a missing or blank base URL", () => {
    expect(createUploadPort(undefined)).toBeNull();
    expect(createUploadPort("")).toBeNull();
    expect(createUploadPort("   ")).toBeNull();
  });

  it("builds the HTTP adapter when a base URL is configured", () => {
    expect(createUploadPort("https://api.test")).toBeInstanceOf(HttpUploadAdapter);
  });
});

describe("UNAVAILABLE_UPLOAD_PORT", () => {
  it("answers a sanitized unavailable code for upload and remove", async () => {
    expect(await UNAVAILABLE_UPLOAD_PORT.uploadDocument({ kind: "cuit", file: file() })).toEqual({
      ok: false,
      code: "unavailable"
    });
    expect(await UNAVAILABLE_UPLOAD_PORT.removeDocument("u/cuit/x.pdf")).toEqual({
      ok: false,
      code: "unavailable"
    });
  });
});

describe("createBrowserUploadPort", () => {
  it("returns the null-object when no base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(createBrowserUploadPort()).toBe(UNAVAILABLE_UPLOAD_PORT);
  });

  it("builds the HTTP adapter when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.test");
    expect(createBrowserUploadPort()).toBeInstanceOf(HttpUploadAdapter);
  });
});
