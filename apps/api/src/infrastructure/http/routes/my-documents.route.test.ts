import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PymeDocumentRecord, PymeDocumentRepositoryPort } from "../../../application/ports/pyme-document-repository-port.js";
import { buildAppAs } from "../test-support/auth.js";
import { buildApp } from "../build-app.js";

/**
 * `GET /pyme-documents/mine` (#530/T2).
 *
 * The route is `PYME`-only, always scopes to `request.principal.userId`, and
 * returns metadata only — the storage object path must never cross the wire.
 */
const OWNER = "00000000-0000-4000-8000-000000000004";
const DOCUMENT_ID = "323e4567-e89b-42d3-a456-426614174000";

const OBJECT_PATH = `${OWNER}/cuit/secret-file.pdf`;

function record(overrides: Partial<PymeDocumentRecord> = {}): PymeDocumentRecord {
  return {
    documentId: DOCUMENT_ID,
    ownerUserId: OWNER,
    kind: "cuit",
    objectPath: OBJECT_PATH,
    name: "constancia-cuit.pdf",
    sizeBytes: 20480,
    contentType: "application/pdf",
    createdAt: "2026-10-15T12:00:00.000Z",
    ...overrides
  };
}

function deps(listByOwner: PymeDocumentRepositoryPort["listByOwner"] = async () => ({ ok: true as const, value: [] })) {
  return { documents: { listByOwner } };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  app = undefined;
});

describe("GET /pyme-documents/mine", () => {
  it("returns the signed-in PyME's own document metadata and never the object path", async () => {
    app = buildAppAs("PYME", { myDocuments: deps(async () => ({ ok: true as const, value: [record()] })) });

    const response = await app.inject({ method: "GET", url: "/pyme-documents/mine" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      documents: [
        {
          documentId: DOCUMENT_ID,
          kind: "cuit",
          name: "constancia-cuit.pdf",
          sizeBytes: 20480,
          contentType: "application/pdf",
          createdAt: "2026-10-15T12:00:00.000Z"
        }
      ]
    });
    // The raw bytes on the wire must not contain the storage path.
    expect(response.body).not.toContain(OBJECT_PATH);
    expect(response.body).not.toContain("objectPath");
  });

  it("returns an empty list for a PyME with no documents", async () => {
    app = buildAppAs("PYME", { myDocuments: deps() });

    const response = await app.inject({ method: "GET", url: "/pyme-documents/mine" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ documents: [] });
  });

  it("scopes the read to the verified principal", async () => {
    const listByOwner = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs("PYME", { myDocuments: deps(listByOwner) });

    await app.inject({ method: "GET", url: `/pyme-documents/mine?owner=${OWNER}` });

    expect(listByOwner).toHaveBeenCalledWith(OWNER);
  });

  it("answers a sanitized 503 when the read fails", async () => {
    app = buildAppAs("PYME", {
      myDocuments: deps(async () => ({ ok: false as const, error: { code: "unavailable" as const } }))
    });

    const response = await app.inject({ method: "GET", url: "/pyme-documents/mine" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("answers 401 without a token (default-deny)", async () => {
    app = buildApp({ myDocuments: deps() });

    const response = await app.inject({ method: "GET", url: "/pyme-documents/mine" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
  });

  it.each(["INVERSOR", "ADMIN"] as const)("rejects %s before the handler runs", async (role) => {
    const listByOwner = vi.fn(async () => ({ ok: true as const, value: [] }));
    app = buildAppAs(role, { myDocuments: deps(listByOwner) });

    const response = await app.inject({ method: "GET", url: "/pyme-documents/mine" });

    expect(response.statusCode).toBe(403);
    expect(listByOwner).not.toHaveBeenCalled();
  });
});
