import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type {
  PymeDocumentInput,
  PymeDocumentRepositoryPort
} from "../../../application/ports/pyme-document-repository-port.js";
import type { StoragePort, UploadObjectInput } from "../../../application/ports/storage-port.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";
import type { StorageRouteDependencies } from "./storage.route.js";

const USER_ID = principalFor("PYME").userId;
const OTHER_ID = principalFor("INVERSOR").userId;
const OBJECT_ID = "99999999-9999-4999-8999-999999999999";

const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

const BOUNDARY = "----vaqcrow-test-boundary";

type Part =
  | { readonly name: string; readonly value: string }
  | { readonly name: string; readonly filename: string; readonly contentType: string; readonly data: Uint8Array };

function multipart(parts: readonly Part[]): { payload: Buffer; contentType: string } {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${BOUNDARY}\r\n`));
    if ("filename" in part) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
            `Content-Type: ${part.contentType}\r\n\r\n`
        )
      );
      chunks.push(Buffer.from(part.data));
      chunks.push(Buffer.from("\r\n"));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`));
    }
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return { payload: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${BOUNDARY}` };
}

interface FakeStorage {
  readonly port: StoragePort;
  readonly uploaded: UploadObjectInput[];
  readonly removed: string[];
}

function fakeStorage(overrides: Partial<StoragePort> = {}): FakeStorage {
  const uploaded: UploadObjectInput[] = [];
  const removed: string[] = [];
  const port: StoragePort = {
    uploadObject: async (input) => {
      uploaded.push(input);
      return { ok: true, value: { path: input.path } };
    },
    removeObject: async (path) => {
      removed.push(path);
      return { ok: true, value: undefined };
    },
    downloadObject: async () => ({
      ok: true,
      value: { bytes: new Uint8Array(), contentType: "application/octet-stream" }
    }),
    ...overrides
  };
  return { port, uploaded, removed };
}

interface FakeDocuments {
  readonly port: PymeDocumentRepositoryPort;
  readonly created: PymeDocumentInput[];
  readonly deleted: string[];
}

function fakeDocuments(overrides: Partial<PymeDocumentRepositoryPort> = {}): FakeDocuments {
  const created: PymeDocumentInput[] = [];
  const deleted: string[] = [];
  const port: PymeDocumentRepositoryPort = {
    create: async (input) => {
      created.push(input);
      return { ok: true, value: { documentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", ...input, createdAt: "2026-10-05T19:00:00.000Z" } };
    },
    listByOwner: async () => ({ ok: true, value: [] }),
    deleteByObjectPath: async (objectPath) => {
      deleted.push(objectPath);
      return { ok: true, value: undefined };
    },
    ...overrides
  };
  return { port, created, deleted };
}

function deps(storage: StoragePort, documents: PymeDocumentRepositoryPort = fakeDocuments().port): StorageRouteDependencies {
  return { storage, documents, generateObjectId: () => OBJECT_ID };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("POST /storage/uploads", () => {
  it("uploads a valid PDF, persists its descriptor and returns the stored descriptor", async () => {
    const fake = fakeStorage();
    const documents = fakeDocuments();
    app = buildAppAs("PYME", { storage: deps(fake.port, documents.port) });
    const body = multipart([
      { name: "kind", value: "cuit" },
      { name: "file", filename: "cuit.pdf", contentType: "application/pdf", data: PDF }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      path: `${USER_ID}/cuit/${OBJECT_ID}-cuit.pdf`,
      kind: "cuit",
      name: "cuit.pdf",
      size: PDF.length,
      contentType: "application/pdf"
    });
    expect(fake.uploaded).toHaveLength(1);
    expect(fake.uploaded[0]?.path).toBe(`${USER_ID}/cuit/${OBJECT_ID}-cuit.pdf`);
    expect(fake.uploaded[0]?.contentType).toBe("application/pdf");
    // The row is derived server-side from the principal and the validated upload.
    expect(documents.created).toEqual([
      {
        ownerUserId: USER_ID,
        kind: "cuit",
        objectPath: `${USER_ID}/cuit/${OBJECT_ID}-cuit.pdf`,
        name: "cuit.pdf",
        sizeBytes: PDF.length,
        contentType: "application/pdf"
      }
    ]);
  });

  it("rejects a declared type outside the allow-list without calling storage", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });
    const body = multipart([
      { name: "kind", value: "cuit" },
      { name: "file", filename: "notes.txt", contentType: "text/plain", data: PDF }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toEqual({ code: "unsupported_type" });
    expect(fake.uploaded).toHaveLength(0);
  });

  it("rejects content whose magic bytes disagree with the declared type", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });
    const body = multipart([
      { name: "kind", value: "cuit" },
      { name: "file", filename: "cuit.pdf", contentType: "application/pdf", data: JPEG }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toEqual({ code: "unsupported_type" });
  });

  it("rejects content larger than the 10 MB cap", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });
    const oversize = new Uint8Array(10485760 + 1);
    oversize.set(PDF);
    const body = multipart([
      { name: "kind", value: "cuit" },
      { name: "file", filename: "big.pdf", contentType: "application/pdf", data: oversize }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({ code: "too_large" });
    expect(fake.uploaded).toHaveLength(0);
  });

  it("accepts a file of exactly the 10 MB cap", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });
    const exact = new Uint8Array(10485760);
    exact.set(PDF);
    const body = multipart([
      { name: "kind", value: "cuit" },
      { name: "file", filename: "exact.pdf", contentType: "application/pdf", data: exact }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(201);
    expect(fake.uploaded).toHaveLength(1);
    expect(fake.uploaded[0]?.bytes.byteLength).toBe(10485760);
  });

  it("rejects a missing file part", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });
    const body = multipart([{ name: "kind", value: "cuit" }]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("rejects a missing kind field", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });
    const body = multipart([{ name: "file", filename: "cuit.pdf", contentType: "application/pdf", data: PDF }]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("rejects a filename with no usable characters", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });
    const body = multipart([
      { name: "kind", value: "cuit" },
      { name: "file", filename: "../../", contentType: "application/pdf", data: PDF }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_name" });
  });

  it("rejects an unknown document kind", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });
    const body = multipart([
      { name: "kind", value: "passport" },
      { name: "file", filename: "cuit.pdf", contentType: "application/pdf", data: PDF }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_kind" });
  });

  it("answers a sanitized 503 when storage fails", async () => {
    const fake = fakeStorage({
      uploadObject: async () => ({ ok: false, error: { code: "unavailable" } })
    });
    app = buildAppAs("PYME", { storage: deps(fake.port) });
    const body = multipart([
      { name: "kind", value: "cuit" },
      { name: "file", filename: "cuit.pdf", contentType: "application/pdf", data: PDF }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("answers 503 and removes the uploaded object when persisting the descriptor fails", async () => {
    const fake = fakeStorage();
    const documents = fakeDocuments({
      create: async () => ({ ok: false, error: { code: "unavailable" } })
    });
    app = buildAppAs("PYME", { storage: deps(fake.port, documents.port) });
    const body = multipart([
      { name: "kind", value: "cuit" },
      { name: "file", filename: "cuit.pdf", contentType: "application/pdf", data: PDF }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
    // No object is left behind with no descriptor pointing at it.
    expect(fake.removed).toEqual([`${USER_ID}/cuit/${OBJECT_ID}-cuit.pdf`]);
  });

  it("does not persist a descriptor when the upload is rejected", async () => {
    const fake = fakeStorage();
    const documents = fakeDocuments();
    app = buildAppAs("PYME", { storage: deps(fake.port, documents.port) });
    const body = multipart([
      { name: "kind", value: "passport" },
      { name: "file", filename: "cuit.pdf", contentType: "application/pdf", data: PDF }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(400);
    expect(documents.created).toHaveLength(0);
  });

  it("denies a non-PYME role", async () => {
    const fake = fakeStorage();
    app = buildAppAs("INVERSOR", { storage: deps(fake.port) });
    const body = multipart([
      { name: "kind", value: "cuit" },
      { name: "file", filename: "cuit.pdf", contentType: "application/pdf", data: PDF }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/storage/uploads",
      headers: { "content-type": body.contentType },
      payload: body.payload
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
  });
});

describe("DELETE /storage/uploads", () => {
  it("removes an object under the caller's own prefix and deletes its descriptor row", async () => {
    const fake = fakeStorage();
    const documents = fakeDocuments();
    app = buildAppAs("PYME", { storage: deps(fake.port, documents.port) });
    const path = `${USER_ID}/cuit/${OBJECT_ID}-cuit.pdf`;

    const response = await app.inject({
      method: "DELETE",
      url: `/storage/uploads?path=${encodeURIComponent(path)}`
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(fake.removed).toEqual([path]);
    expect(documents.deleted).toEqual([path]);
  });

  it("refuses a path outside the caller's prefix without calling storage or the repository", async () => {
    const fake = fakeStorage();
    const documents = fakeDocuments();
    app = buildAppAs("PYME", { storage: deps(fake.port, documents.port) });

    const response = await app.inject({
      method: "DELETE",
      url: `/storage/uploads?path=${encodeURIComponent(`${OTHER_ID}/cuit/x.pdf`)}`
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
    expect(fake.removed).toHaveLength(0);
    expect(documents.deleted).toHaveLength(0);
  });

  it("refuses the bare prefix with no object name", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });

    const response = await app.inject({
      method: "DELETE",
      url: `/storage/uploads?path=${encodeURIComponent(`${USER_ID}/`)}`
    });

    expect(response.statusCode).toBe(403);
    expect(fake.removed).toHaveLength(0);
  });

  it("refuses a path that starts with the caller's prefix but escapes it with ..", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });
    const path = `${USER_ID}/cuit/../${OTHER_ID}/secret.pdf`;

    const response = await app.inject({
      method: "DELETE",
      url: `/storage/uploads?path=${encodeURIComponent(path)}`
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
    expect(fake.removed).toHaveLength(0);
  });

  it("refuses a path with a . segment, an empty segment or a leading slash", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });

    for (const path of [
      `${USER_ID}/./cuit/x.pdf`,
      `${USER_ID}//cuit/x.pdf`,
      `${USER_ID}/cuit//x.pdf`,
      `${USER_ID}/cuit/x.pdf/`
    ]) {
      const response = await app.inject({
        method: "DELETE",
        url: `/storage/uploads?path=${encodeURIComponent(path)}`
      });

      expect(response.statusCode, path).toBe(403);
    }
    expect(fake.removed).toHaveLength(0);
  });

  it("treats a not_found removal as the idempotent success it documents, still clearing the row", async () => {
    const fake = fakeStorage({
      removeObject: async () => ({ ok: false, error: { code: "not_found" } })
    });
    const documents = fakeDocuments();
    app = buildAppAs("PYME", { storage: deps(fake.port, documents.port) });
    const path = `${USER_ID}/cuit/x.pdf`;

    const response = await app.inject({
      method: "DELETE",
      url: `/storage/uploads?path=${encodeURIComponent(path)}`
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(documents.deleted).toEqual([path]);
  });

  it("rejects a request with no path", async () => {
    const fake = fakeStorage();
    app = buildAppAs("PYME", { storage: deps(fake.port) });

    const response = await app.inject({ method: "DELETE", url: "/storage/uploads" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("answers a sanitized 503 when storage fails", async () => {
    const fake = fakeStorage({
      removeObject: async () => ({ ok: false, error: { code: "unavailable" } })
    });
    app = buildAppAs("PYME", { storage: deps(fake.port) });

    const response = await app.inject({
      method: "DELETE",
      url: `/storage/uploads?path=${encodeURIComponent(`${USER_ID}/cuit/x.pdf`)}`
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("answers a sanitized 503 when clearing the descriptor row fails", async () => {
    const fake = fakeStorage();
    const documents = fakeDocuments({
      deleteByObjectPath: async () => ({ ok: false, error: { code: "unavailable" } })
    });
    app = buildAppAs("PYME", { storage: deps(fake.port, documents.port) });

    const response = await app.inject({
      method: "DELETE",
      url: `/storage/uploads?path=${encodeURIComponent(`${USER_ID}/cuit/x.pdf`)}`
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
    // The object was already removed; the caller may retry the idempotent delete.
    expect(fake.removed).toEqual([`${USER_ID}/cuit/x.pdf`]);
  });

  it("denies a non-PYME role", async () => {
    const fake = fakeStorage();
    app = buildAppAs("INVERSOR", { storage: deps(fake.port) });

    const response = await app.inject({
      method: "DELETE",
      url: `/storage/uploads?path=${encodeURIComponent(`${USER_ID}/cuit/x.pdf`)}`
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
  });
});
