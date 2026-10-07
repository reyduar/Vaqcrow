import type {
  ApplicationAssessmentRead,
  ApplicationId,
  ApplicationReviewSnapshot,
  DocumentVerdictRecord,
  HumanDecisionRecord
} from "@vaqcrow/contracts";
import type { BusinessRecord } from "./business-repository-port.js";
import type { PymeDocumentRecord } from "./pyme-document-repository-port.js";
import type { SmeRequestRecord } from "./sme-request-repository-port.js";

/** The descriptor exposed to the ADMIN viewer; `objectPath` is never a public URL. */
export type AdminReviewDocumentDescriptor = Readonly<
  Pick<PymeDocumentRecord, "documentId" | "kind" | "objectPath" | "name" | "sizeBytes" | "contentType" | "createdAt">
>;

export type AdminReviewSmeRequest = Omit<SmeRequestRecord, "ownerUserId"> & { readonly ownerUserId: string };

/** The vendor-free read model for the future ADMIN review console. */
export interface AdminReviewContext {
  readonly applicationReview: ApplicationReviewSnapshot;
  readonly smeRequest: AdminReviewSmeRequest;
  readonly company: BusinessRecord | null;
  readonly documents: readonly AdminReviewDocumentDescriptor[];
  readonly assessment: ApplicationAssessmentRead | null;
  readonly latestHumanDecision: HumanDecisionRecord | null;
  /** The current per-document verdicts (#410/U1); empty when none were set. */
  readonly documentVerdicts: readonly DocumentVerdictRecord[];
}

export type AdminReviewContextResult =
  | { readonly ok: true; readonly value: AdminReviewContext }
  | { readonly ok: false; readonly error: { readonly code: "not_found" | "unavailable" } };

export interface AdminReviewContextPort {
  get(applicationId: ApplicationId): Promise<AdminReviewContextResult>;
}
