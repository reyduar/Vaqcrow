import type { DocumentKind } from "../storage/document-upload.js";

/**
 * The persisted PyME document boundary (content-relevance/vision feature, U1).
 *
 * One row per upload: the API validates the bytes, writes the object to the
 * private `pyme-documents` bucket and records the descriptor here. This is the
 * queryable server-side list the future content-relevance check (U5) resolves to
 * find the objects it must read — the upload response path is not enough.
 *
 * `public.pyme_document` is `service_role`-only with zero RLS policies, so every
 * read the adapter issues is scoped by the authenticated owner the caller
 * resolved from the verified token. The owner is never part of a request body.
 *
 * Plain data only: this port lives in `application/` and must not import
 * Fastify, Supabase, Stellar or LLM SDKs.
 */

export interface PymeDocumentInput {
  /** The verified principal; never a client-supplied id. */
  readonly ownerUserId: string;
  readonly kind: DocumentKind;
  /** `${ownerUserId}/${kind}/${uuid}-${sanitized-name}`, derived server-side. */
  readonly objectPath: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly contentType: string;
}

export interface PymeDocumentRecord extends PymeDocumentInput {
  readonly documentId: string;
  readonly createdAt: string;
}

export type PymeDocumentRepositoryErrorCode = "invalid_request" | "unavailable";

export interface PymeDocumentRepositoryError {
  readonly code: PymeDocumentRepositoryErrorCode;
}

export type PymeDocumentRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PymeDocumentRepositoryError };

export interface PymeDocumentRepositoryPort {
  /** Stores the descriptor for an object already written to the bucket. */
  create(input: PymeDocumentInput): Promise<PymeDocumentRepositoryResult<PymeDocumentRecord>>;

  /** The owner's documents, oldest first; an empty array when none exist. */
  listByOwner(ownerUserId: string): Promise<PymeDocumentRepositoryResult<readonly PymeDocumentRecord[]>>;

  /** Looks up one persisted descriptor by its server-generated object path. */
  findByObjectPath(objectPath: string): Promise<PymeDocumentRepositoryResult<PymeDocumentRecord | undefined>>;

  /**
   * Removes the descriptor for `objectPath`. Removing a missing row is not an
   * error (idempotent), matching the storage port's removal semantics.
   */
  deleteByObjectPath(objectPath: string): Promise<PymeDocumentRepositoryResult<void>>;
}
