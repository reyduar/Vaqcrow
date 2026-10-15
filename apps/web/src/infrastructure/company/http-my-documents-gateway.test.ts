import { describe, expect, it, vi } from "vitest";
import { HttpClientError, type HttpClientPort } from "@/application/ports/http-client-port";
import { HttpMyDocumentsGateway } from "./http-my-documents-gateway";

const DOC_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_DOC_ID = "22222222-2222-4222-8222-222222222222";

const DOCUMENT = {
  documentId: DOC_ID,
  kind: "cuit",
  name: "constancia-cuit.pdf",
  sizeBytes: 128_512,
  contentType: "application/pdf",
  createdAt: "2026-10-03T12:00:00.000Z"
};

function client(body: unknown, status = 200) {
  const send = vi.fn().mockResolvedValue({ status, body });
  return { port: { send } as unknown as HttpClientPort, send };
}

/** Mirrors the `HttpClientPort` contract: a failure rejects with a sanitized `HttpClientError`. */
function failing(error: HttpClientError) {
  const send = vi.fn().mockRejectedValue(error);
  return { port: { send } as unknown as HttpClientPort, send };
}

describe("HttpMyDocumentsGateway", () => {
  it("reads the caller's own document metadata from GET /pyme-documents/mine", async () => {
    const { port, send } = client({ documents: [DOCUMENT] });

    const outcome = await new HttpMyDocumentsGateway(port).listMine();

    expect(send).toHaveBeenCalledWith({ method: "GET", path: "/pyme-documents/mine" });
    expect(outcome).toEqual({ ok: true, documents: [DOCUMENT] });
  });

  it("resolves an owner with no documents as an empty list, never an invented one", async () => {
    const { port } = client({ documents: [] });

    expect(await new HttpMyDocumentsGateway(port).listMine()).toEqual({ ok: true, documents: [] });
  });

  it("never trusts a malformed success body (a leaked object path, a stray key, a bad id)", async () => {
    // Even though the server must never send `objectPath`, a body that carries
    // one is refused — the strict schema is the wire guard.
    await expect(
      new HttpMyDocumentsGateway(client({ documents: [{ ...DOCUMENT, objectPath: "s3://bucket/secret" }] }).port).listMine()
    ).resolves.toEqual({ ok: false, code: "unavailable" });
    await expect(
      new HttpMyDocumentsGateway(client({ documents: [{ ...DOCUMENT, documentId: "not-a-uuid" }] }).port).listMine()
    ).resolves.toEqual({ ok: false, code: "unavailable" });
    await expect(
      new HttpMyDocumentsGateway(client({ documents: [{ ...DOCUMENT, kind: "invented" }] }).port).listMine()
    ).resolves.toEqual({ ok: false, code: "unavailable" });
    await expect(new HttpMyDocumentsGateway(client({ notTheContract: true }).port).listMine()).resolves.toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("keeps every document when the list carries more than one", async () => {
    const second = { ...DOCUMENT, documentId: OTHER_DOC_ID, kind: "photo", name: "local.jpg", contentType: "image/jpeg" };
    const { port } = client({ documents: [DOCUMENT, second] });

    const outcome = await new HttpMyDocumentsGateway(port).listMine();

    expect(outcome).toEqual({ ok: true, documents: [DOCUMENT, second] });
  });

  it("maps 401 and 403 to the session's unauthenticated outcome", async () => {
    await expect(new HttpMyDocumentsGateway(failing(new HttpClientError("http", 401)).port).listMine()).resolves.toEqual({
      ok: false,
      code: "unauthenticated"
    });
    await expect(new HttpMyDocumentsGateway(failing(new HttpClientError("http", 403)).port).listMine()).resolves.toEqual({
      ok: false,
      code: "unauthenticated"
    });
  });

  it("maps every other non-200 to unavailable and a transport failure to network", async () => {
    await expect(new HttpMyDocumentsGateway(failing(new HttpClientError("http", 500)).port).listMine()).resolves.toEqual({
      ok: false,
      code: "unavailable"
    });
    await expect(new HttpMyDocumentsGateway(failing(new HttpClientError("http", 503)).port).listMine()).resolves.toEqual({
      ok: false,
      code: "unavailable"
    });
    await expect(new HttpMyDocumentsGateway(failing(new HttpClientError("network")).port).listMine()).resolves.toEqual({
      ok: false,
      code: "network"
    });
  });
});
