import { describe, expect, it } from "vitest";
import type { PymeDocumentRecord, PymeDocumentRepositoryPort } from "../ports/pyme-document-repository-port.js";
import { getMyDocuments } from "./get-my-documents.js";

/**
 * `getMyDocuments` (#530/T2): the owner's own document metadata, resolved from
 * the verified owner only. The storage object path is server-side and must
 * never cross the wire.
 */
const OWNER = "00000000-0000-4000-8000-000000000004";
const DOCUMENT_ID = "323e4567-e89b-42d3-a456-426614174000";

function record(overrides: Partial<PymeDocumentRecord> = {}): PymeDocumentRecord {
  return {
    documentId: DOCUMENT_ID,
    ownerUserId: OWNER,
    kind: "cuit",
    objectPath: `${OWNER}/cuit/secret-file.pdf`,
    name: "constancia-cuit.pdf",
    sizeBytes: 20480,
    contentType: "application/pdf",
    createdAt: "2026-10-15T12:00:00.000Z",
    ...overrides
  };
}

function deps(listByOwner: PymeDocumentRepositoryPort["listByOwner"]) {
  return { documents: { listByOwner } };
}

describe("getMyDocuments", () => {
  it("returns the owner's documents as metadata, scoped to that owner", async () => {
    let seen: string | undefined;
    const result = await getMyDocuments(
      deps(async (owner) => {
        seen = owner;
        return { ok: true as const, value: [record()] };
      }),
      { ownerUserId: OWNER }
    );

    expect(seen).toBe(OWNER);
    expect(result).toEqual({
      ok: true,
      value: {
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
      }
    });
  });

  it("never carries the storage object path", async () => {
    const result = await getMyDocuments(deps(async () => ({ ok: true as const, value: [record()] })), {
      ownerUserId: OWNER
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(Object.keys(result.value.documents[0]!)).not.toContain("objectPath");
    expect(JSON.stringify(result.value)).not.toContain("secret-file.pdf");
  });

  it("returns an empty list when the owner has no documents", async () => {
    const result = await getMyDocuments(deps(async () => ({ ok: true as const, value: [] })), {
      ownerUserId: OWNER
    });

    expect(result).toEqual({ ok: true, value: { documents: [] } });
  });

  it("is unavailable when the read fails", async () => {
    const result = await getMyDocuments(
      deps(async () => ({ ok: false as const, error: { code: "unavailable" as const } })),
      { ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});
