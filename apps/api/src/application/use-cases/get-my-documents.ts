import { myDocumentsReadSchema } from "@vaqcrow/contracts";
import type { MyDocument, MyDocumentsRead } from "@vaqcrow/contracts";
import type { PymeDocumentRecord, PymeDocumentRepositoryPort } from "../ports/pyme-document-repository-port.js";

/**
 * Lists the caller's own uploaded document metadata (Feature #530, T2).
 *
 * The caller is always the verified principal: the use case reads the owner's
 * descriptors through `listByOwner(input.ownerUserId)` — never a client-supplied
 * id. Only metadata crosses the wire: the storage object path is server-side and
 * is dropped here, and the strict contract would refuse it if it ever returned.
 * A read that cannot complete is `unavailable`, never a 200 with a partial list.
 */

export interface GetMyDocumentsDependencies {
  readonly documents: Pick<PymeDocumentRepositoryPort, "listByOwner">;
}

export type GetMyDocumentsResult =
  | { readonly ok: true; readonly value: MyDocumentsRead }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function getMyDocuments(
  dependencies: GetMyDocumentsDependencies,
  input: { readonly ownerUserId: string }
): Promise<GetMyDocumentsResult> {
  const listed = await dependencies.documents.listByOwner(input.ownerUserId);
  if (!listed.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  try {
    return { ok: true, value: myDocumentsReadSchema.parse({ documents: listed.value.map(toMetadata) }) };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}

/** Projects a persisted descriptor to its wire metadata — never the object path. */
function toMetadata(record: PymeDocumentRecord): MyDocument {
  return {
    documentId: record.documentId,
    kind: record.kind,
    name: record.name,
    sizeBytes: record.sizeBytes,
    contentType: record.contentType,
    createdAt: record.createdAt
  };
}
