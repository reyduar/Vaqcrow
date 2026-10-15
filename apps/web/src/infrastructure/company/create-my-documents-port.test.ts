import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserMyDocumentsPort, createMyDocumentsPort } from "./create-my-documents-port";
import { HttpMyDocumentsGateway } from "./http-my-documents-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createMyDocumentsPort", () => {
  it("returns null without a base URL", () => {
    expect(createMyDocumentsPort(undefined)).toBeNull();
    expect(createMyDocumentsPort("")).toBeNull();
    expect(createMyDocumentsPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway from a trimmed base URL", () => {
    const port = createMyDocumentsPort("  http://localhost:3000  ");
    expect(port).toBeInstanceOf(HttpMyDocumentsGateway);
  });
});

describe("createBrowserMyDocumentsPort", () => {
  it("returns null without a configured base URL, never a fabricated empty list", () => {
    expect(createBrowserMyDocumentsPort()).toBeNull();
  });

  it("builds a gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:3000");
    const port = createBrowserMyDocumentsPort();
    expect(port).toBeInstanceOf(HttpMyDocumentsGateway);
  });
});
