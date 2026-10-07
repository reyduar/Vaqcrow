import type { ApplicationId, DocumentVerdictRecord, DocumentVerdictValue } from "@vaqcrow/contracts";

/**
 * The persisted per-document KYC/KYB verdicts (Feature #410, U1, decision D8).
 *
 * One row per (application, document) holds the current verdict and the admin
 * who set it. `public.document_verdict` is `service_role`-only with zero RLS
 * policies, so the API is the single writer and the actor always comes from the
 * verified principal the caller resolved, never from a request body.
 *
 * Plain data only: this port lives in `application/` and must not import
 * Fastify, Supabase, Stellar or LLM SDKs.
 */

export interface SetDocumentVerdictInput {
  readonly applicationId: ApplicationId;
  readonly documentId: string;
  readonly verdict: DocumentVerdictValue;
  /** The authenticated admin's display name. */
  readonly actor: string;
  /** The authenticated admin's user id. */
  readonly actorUserId: string;
}

export interface SetDocumentVerdictOutcome {
  /** `false` when the stored verdict already had this value (a replay). */
  readonly applied: boolean;
  readonly verdict: DocumentVerdictRecord;
}

/** `not_found` means the application or document row does not exist. */
export type DocumentVerdictRepositoryErrorCode = "not_found" | "unavailable";

export interface DocumentVerdictRepositoryError {
  readonly code: DocumentVerdictRepositoryErrorCode;
}

export type DocumentVerdictRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DocumentVerdictRepositoryError };

export interface DocumentVerdictRepositoryPort {
  /** The application's current verdicts; an empty array when none were set. */
  listByApplication(applicationId: ApplicationId): Promise<DocumentVerdictRepositoryResult<readonly DocumentVerdictRecord[]>>;

  /**
   * Current-value semantics: inserts the verdict when absent, otherwise updates
   * it only when the stored value differs. Setting the value already stored is
   * a no-op that returns the existing row with `applied: false`, so a replayed
   * request never double-applies.
   */
  setVerdict(input: SetDocumentVerdictInput): Promise<DocumentVerdictRepositoryResult<SetDocumentVerdictOutcome>>;
}
