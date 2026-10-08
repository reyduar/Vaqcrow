import { z } from "zod";

/**
 * Per-document KYC/KYB verdicts an admin records in the review console
 * (Feature #410, U1, decision D8).
 *
 * `valid` accepts the document, `request` asks the PyME to provide it again and
 * `invalid` rejects it. A verdict is advisory input to the human decision; it
 * never approves an application by itself.
 */
export const documentVerdictValueSchema = z.enum(["valid", "request", "invalid"]);

export type DocumentVerdictValue = z.infer<typeof documentVerdictValueSchema>;

/** The server-generated id of a persisted PyME document (`pyme_document.id`). */
export const pymeDocumentIdSchema = z.uuid();

/**
 * The request body. It carries only the verdict: the actor is the
 * authenticated admin, resolved server-side, and is never accepted from a body.
 */
export const documentVerdictCommandSchema = z.strictObject({
  verdict: documentVerdictValueSchema
});

export type DocumentVerdictCommand = z.infer<typeof documentVerdictCommandSchema>;

/** The current verdict on one document, as the review console renders it. */
export const documentVerdictRecordSchema = z.strictObject({
  documentId: pymeDocumentIdSchema,
  verdict: documentVerdictValueSchema,
  actor: z.string().trim().min(1).max(120),
  updatedAt: z.iso.datetime({ offset: true })
});

export type DocumentVerdictRecord = z.infer<typeof documentVerdictRecordSchema>;

export function parseDocumentVerdictValue(input: unknown): DocumentVerdictValue {
  return documentVerdictValueSchema.parse(input);
}

export function parsePymeDocumentId(input: unknown): string {
  return pymeDocumentIdSchema.parse(input);
}

export function parseDocumentVerdictCommand(input: unknown): DocumentVerdictCommand {
  return documentVerdictCommandSchema.parse(input);
}

export function parseDocumentVerdictRecord(input: unknown): DocumentVerdictRecord {
  return documentVerdictRecordSchema.parse(input);
}
