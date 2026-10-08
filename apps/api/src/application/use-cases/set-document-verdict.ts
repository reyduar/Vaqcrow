import type { ApplicationId, ApplicationReviewState, DocumentVerdictValue } from "@vaqcrow/contracts";
import type { ApplicationReviewRepositoryPort } from "../ports/application-review-repository-port.js";
import type {
  DocumentVerdictRepositoryPort,
  SetDocumentVerdictOutcome
} from "../ports/document-verdict-repository-port.js";
import type { PymeDocumentRepositoryPort } from "../ports/pyme-document-repository-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";

/**
 * Records an admin's verdict on one PyME document of an application under
 * review (Feature #410, U1, decision D8).
 *
 * Verdicts are editable only while the review is still open
 * (`awaiting_assessment` / `human_review`); once a human decision closed it, an
 * edit is a `state_conflict` carrying the actual state. The document must be one
 * the application's owner uploaded, otherwise the request is `not_found` — an
 * admin cannot attach a verdict for another PyME's document to this
 * application. The actor is the verified principal, never request data.
 */

const EDITABLE_STATES: ReadonlySet<ApplicationReviewState> = new Set(["awaiting_assessment", "human_review"]);

export interface SetDocumentVerdictDependencies {
  readonly applicationReviews: Pick<ApplicationReviewRepositoryPort, "findById">;
  readonly smeRequests: Pick<SmeRequestRepositoryPort, "findByApplicationId">;
  readonly documents: Pick<PymeDocumentRepositoryPort, "listByOwner">;
  readonly verdicts: Pick<DocumentVerdictRepositoryPort, "setVerdict">;
}

export interface SetDocumentVerdictRequest {
  readonly applicationId: ApplicationId;
  readonly documentId: string;
  readonly verdict: DocumentVerdictValue;
  /** The verified principal; never a client-supplied value. */
  readonly actor: { readonly userId: string; readonly displayName: string };
}

export type SetDocumentVerdictError =
  | { readonly code: "not_found" }
  | { readonly code: "state_conflict"; readonly actualState: ApplicationReviewState }
  | { readonly code: "unavailable" };

export type SetDocumentVerdictResult =
  | { readonly ok: true; readonly value: SetDocumentVerdictOutcome }
  | { readonly ok: false; readonly error: SetDocumentVerdictError };

const NOT_FOUND: SetDocumentVerdictResult = { ok: false, error: { code: "not_found" } };
const UNAVAILABLE: SetDocumentVerdictResult = { ok: false, error: { code: "unavailable" } };

export async function setDocumentVerdict(
  dependencies: SetDocumentVerdictDependencies,
  input: SetDocumentVerdictRequest
): Promise<SetDocumentVerdictResult> {
  try {
    const review = await dependencies.applicationReviews.findById(input.applicationId);
    if (!review.ok) return review.error.code === "not_found" ? NOT_FOUND : UNAVAILABLE;

    if (!EDITABLE_STATES.has(review.value.state)) {
      return { ok: false, error: { code: "state_conflict", actualState: review.value.state } };
    }

    const smeRequest = await dependencies.smeRequests.findByApplicationId(input.applicationId);
    if (!smeRequest.ok) return smeRequest.error.code === "not_found" ? NOT_FOUND : UNAVAILABLE;

    // Legacy rows without ownership cannot be safely tied to a document.
    const ownerUserId = smeRequest.value.ownerUserId;
    if (ownerUserId === undefined) return UNAVAILABLE;

    const documents = await dependencies.documents.listByOwner(ownerUserId);
    if (!documents.ok) return UNAVAILABLE;
    if (!documents.value.some((document) => document.documentId === input.documentId)) return NOT_FOUND;

    const result = await dependencies.verdicts.setVerdict({
      applicationId: input.applicationId,
      documentId: input.documentId,
      verdict: input.verdict,
      actor: input.actor.displayName,
      actorUserId: input.actor.userId
    });
    if (!result.ok) return result.error.code === "not_found" ? NOT_FOUND : UNAVAILABLE;

    return { ok: true, value: result.value };
  } catch {
    return UNAVAILABLE;
  }
}
