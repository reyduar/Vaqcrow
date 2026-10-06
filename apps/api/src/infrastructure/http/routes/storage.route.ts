import type { FastifyInstance } from "fastify";
import type { PymeDocumentRepositoryPort } from "../../../application/ports/pyme-document-repository-port.js";
import type { StoragePort } from "../../../application/ports/storage-port.js";
import { validateDocumentUpload } from "../../../application/storage/document-upload.js";
import type { UploadRejectionCode } from "../../../application/storage/document-upload.js";
import { isOwnedObjectPath } from "../../../application/storage/object-path.js";

/**
 * The HTTP surface for PyME document uploads (Feature #398, Task #399 / T4b;
 * server-side persistence, content-relevance/vision feature U1).
 *
 * The browser sends the file here; the API validates the bytes and only then
 * writes to the private `pyme-documents` bucket. `POST /storage/uploads` takes a
 * multipart `file` part plus a `kind` field and answers `201` with the stored
 * descriptor, recording the row the content-relevance check will resolve.
 * `DELETE /storage/uploads?path=` removes one object, but only after checking
 * the path is under the authenticated caller's own `userId/` prefix — the
 * adapter writes with `service_role`, which bypasses RLS, so this check is the
 * API's responsibility. The same request removes the descriptor row.
 *
 * The document owner, kind and path are derived server-side from the principal
 * and the validated upload, never trusted from the body.
 *
 * Every failure is a sanitized `{ code }`: no provider text, no filename echo.
 */

export interface StorageRouteDependencies {
  readonly storage: StoragePort;
  /** Records the row that makes an uploaded object queryable server-side. */
  readonly documents: PymeDocumentRepositoryPort;
  /** Injected so tests are deterministic; `index.ts` passes `crypto.randomUUID`. */
  readonly generateObjectId: () => string;
}

const FILE_TOO_LARGE = "FST_REQ_FILE_TOO_LARGE";

function isFileTooLarge(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === FILE_TOO_LARGE
  );
}

function rejectionStatus(code: UploadRejectionCode): number {
  switch (code) {
    case "too_large":
      return 413;
    case "unsupported_type":
      return 415;
    case "invalid_name":
    case "invalid_kind":
      return 400;
  }
}

function isValidObjectPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > 1024 || path.includes("\\")) {
    return false;
  }

  const segments = path.split("/");
  return (
    segments.length === 3 &&
    segments.every(
      (segment) =>
        segment.length > 0 && segment !== "." && segment !== ".." && /^[A-Za-z0-9._-]+$/.test(segment)
    )
  );
}

function storageDownloadFailureStatus(code: "not_found" | "invalid_path" | "unavailable"): number {
  switch (code) {
    case "not_found":
      return 404;
    case "invalid_path":
      return 400;
    case "unavailable":
      return 503;
  }
}

function contentDisposition(name: string): string {
  const safeName = name.replace(/[\u0000-\u001f\u007f"\\]/g, "_") || "download";
  return `inline; filename="${safeName}"`;
}

export function registerStorageRoute(app: FastifyInstance, dependencies: StorageRouteDependencies): void {
  app.post("/storage/uploads", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }
    if (!request.isMultipart()) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    let kind: string | undefined;
    let file: { filename: string; contentType: string; bytes: Buffer } | undefined;

    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (file !== undefined) {
            return reply.code(400).send({ code: "invalid_request" });
          }
          const bytes = await part.toBuffer();
          file = { filename: part.filename, contentType: part.mimetype, bytes };
        } else if (part.fieldname === "kind") {
          kind = String(part.value);
        }
      }
    } catch (error) {
      return isFileTooLarge(error)
        ? reply.code(413).send({ code: "too_large" })
        : reply.code(400).send({ code: "invalid_request" });
    }

    if (file === undefined || kind === undefined) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const validated = validateDocumentUpload({
      userId: principal.userId,
      kind,
      filename: file.filename,
      contentType: file.contentType,
      bytes: file.bytes,
      generateId: dependencies.generateObjectId
    });

    if (!validated.ok) {
      return reply.code(rejectionStatus(validated.code)).send({ code: validated.code });
    }

    const uploaded = await dependencies.storage.uploadObject({
      path: validated.value.path,
      bytes: file.bytes,
      contentType: validated.value.contentType
    });

    if (!uploaded.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    const persisted = await dependencies.documents.create({
      ownerUserId: principal.userId,
      kind: validated.value.kind,
      objectPath: uploaded.value.path,
      name: validated.value.name,
      sizeBytes: validated.value.size,
      contentType: validated.value.contentType
    });

    if (!persisted.ok) {
      // The object is already in the bucket; a descriptor-less object is not
      // queryable by the content-relevance check, so compensate by removing it
      // rather than leaving an orphan behind.
      await dependencies.storage.removeObject(uploaded.value.path);
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(201).send({
      path: uploaded.value.path,
      kind: validated.value.kind,
      name: validated.value.name,
      size: validated.value.size,
      contentType: validated.value.contentType
    });
  });

  app.delete<{ Querystring: { path?: string } }>("/storage/uploads", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const path = request.query.path;
    if (typeof path !== "string" || path.length === 0) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    // service_role bypasses RLS, so ownership is enforced here and nowhere else.
    // The check lives in one place (`isOwnedObjectPath`) so the content-relevance
    // download reuses the exact same discipline before reading object bytes.
    if (!isOwnedObjectPath(path, principal.userId)) {
      return reply.code(403).send({ code: "forbidden" });
    }

    const removed = await dependencies.storage.removeObject(path);
    if (!removed.ok && removed.error.code !== "not_found") {
      return reply.code(503).send({ code: "unavailable" });
    }

    // Clear the descriptor row. Removing a missing object is the idempotent
    // success the port documents; the row is still cleared so a retried delete
    // leaves no orphan behind, and the repository's delete is idempotent too.
    const deleted = await dependencies.documents.deleteByObjectPath(path);
    if (!deleted.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(204).send();
  });

  app.get<{ Querystring: { path?: string } }>("/storage/uploads", async (request, reply) => {
    const path = request.query.path;
    if (!isValidObjectPath(path)) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    try {
      const descriptor = await dependencies.documents.findByObjectPath(path);
      if (!descriptor.ok) {
        return reply.code(503).send({ code: "unavailable" });
      }
      if (descriptor.value === undefined || descriptor.value.objectPath !== path) {
        return reply.code(404).send({ code: "not_found" });
      }

      const downloaded = await dependencies.storage.downloadObject(path);
      if (!downloaded.ok) {
        const status = storageDownloadFailureStatus(downloaded.error.code);
        const code =
          downloaded.error.code === "not_found" ? "not_found" : status === 400 ? "invalid_request" : "unavailable";
        return reply.code(status).send({ code });
      }

      return reply
        .header("Cache-Control", "private, no-store")
        .header("Content-Disposition", contentDisposition(descriptor.value.name))
        .header("X-Content-Type-Options", "nosniff")
        .type(descriptor.value.contentType)
        .send(Buffer.from(downloaded.value.bytes));
    } catch {
      return reply.code(503).send({ code: "unavailable" });
    }
  });
}
