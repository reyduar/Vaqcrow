import type { FastifyInstance } from "fastify";
import type { StoragePort } from "../../../application/ports/storage-port.js";
import { validateDocumentUpload } from "../../../application/storage/document-upload.js";
import type { UploadRejectionCode } from "../../../application/storage/document-upload.js";

/**
 * The HTTP surface for PyME document uploads (Feature #398, Task #399 / T4b).
 *
 * The browser sends the file here; the API validates the bytes and only then
 * writes to the private `pyme-documents` bucket. `POST /storage/uploads` takes a
 * multipart `file` part plus a `kind` field and answers `201` with the stored
 * descriptor. `DELETE /storage/uploads?path=` removes one object, but only after
 * checking the path is under the authenticated caller's own `userId/` prefix —
 * the adapter writes with `service_role`, which bypasses RLS, so this check is
 * the API's responsibility.
 *
 * Every failure is a sanitized `{ code }`: no provider text, no filename echo.
 */

export interface StorageRouteDependencies {
  readonly storage: StoragePort;
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
    const prefix = `${principal.userId}/`;
    if (!path.startsWith(prefix) || path.length <= prefix.length) {
      return reply.code(403).send({ code: "forbidden" });
    }

    const removed = await dependencies.storage.removeObject(path);
    if (!removed.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(204).send();
  });
}
