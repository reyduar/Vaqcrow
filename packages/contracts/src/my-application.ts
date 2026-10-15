import { z } from "zod";
import { applicationIdSchema } from "./application-id.js";
import { applicationReviewStateSchema } from "./application-review.js";
import { pymeDocumentIdSchema } from "./document-verdict.js";

/**
 * The company post-submission read models (Feature #530, T1/T2).
 *
 * `GET /sme-requests/mine` resolves the caller's own latest application and its
 * real `application_review` state; `GET /pyme-documents/mine` lists the metadata
 * of the caller's own uploaded documents. Both are `PYME`-only, and both take
 * their identity from the verified principal server-side, so no owner id, user
 * id or other caller-supplied identity crosses this boundary — a foreign
 * application is an absence (`application: null`), never another owner's data.
 *
 * The documents response is metadata only: a storage object path is a server
 * secret and never crosses the wire, so the shape carries the descriptor fields
 * (id, kind, name, size, content type, creation time) and nothing else. Both
 * shapes are strict, so an unexpected key — in particular an `objectPath` — is
 * refused rather than silently forwarded.
 */

/** The four persisted upload kinds (`DOCUMENT_KINDS` in `apps/api`). */
export const pymeDocumentKindSchema = z.enum([
  "sales-declarations",
  "cuit",
  "articles-of-incorporation",
  "photo"
]);

export type PymeDocumentKind = z.infer<typeof pymeDocumentKindSchema>;

/** The owner's own application: its server-generated id and its real state. */
export const myApplicationSchema = z.strictObject({
  applicationId: applicationIdSchema,
  state: applicationReviewStateSchema
});

export type MyApplication = z.infer<typeof myApplicationSchema>;

/**
 * `GET /sme-requests/mine` response. `application` is `null` exactly when the
 * caller owns no application — an absence, never a fabricated row.
 */
export const myApplicationReadSchema = z.strictObject({
  application: myApplicationSchema.nullable()
});

export type MyApplicationRead = z.infer<typeof myApplicationReadSchema>;

/**
 * One uploaded document's metadata. Deliberately no `objectPath`: the storage
 * path is server-side only and must never reach a client.
 */
export const myDocumentSchema = z.strictObject({
  documentId: pymeDocumentIdSchema,
  kind: pymeDocumentKindSchema,
  name: z.string().trim().min(1),
  sizeBytes: z.number().int().nonnegative(),
  contentType: z.string().trim().min(1),
  createdAt: z.iso.datetime({ offset: true })
});

export type MyDocument = z.infer<typeof myDocumentSchema>;

/** `GET /pyme-documents/mine` response: the caller's own document metadata. */
export const myDocumentsReadSchema = z.strictObject({
  documents: z.array(myDocumentSchema)
});

export type MyDocumentsRead = z.infer<typeof myDocumentsReadSchema>;

export function parseMyApplicationRead(input: unknown): MyApplicationRead {
  return myApplicationReadSchema.parse(input);
}

export function parseMyDocumentsRead(input: unknown): MyDocumentsRead {
  return myDocumentsReadSchema.parse(input);
}
