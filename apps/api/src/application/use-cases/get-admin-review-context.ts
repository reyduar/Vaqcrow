import type { ApplicationId } from "@vaqcrow/contracts";
import type { AdminReviewContextPort } from "../ports/admin-review-context-port.js";
import type { ApplicationAssessmentRepositoryPort } from "../ports/application-assessment-repository-port.js";
import type { ApplicationReviewRepositoryPort } from "../ports/application-review-repository-port.js";
import type { BusinessRepositoryPort } from "../ports/business-repository-port.js";
import type { PymeDocumentRepositoryPort } from "../ports/pyme-document-repository-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";

export interface GetAdminReviewContextDependencies {
  readonly applicationReviews: Pick<ApplicationReviewRepositoryPort, "findById" | "readLatestHumanDecision">;
  readonly smeRequests: Pick<SmeRequestRepositoryPort, "findByApplicationId">;
  readonly businesses: Pick<BusinessRepositoryPort, "findByOwner">;
  readonly documents: Pick<PymeDocumentRepositoryPort, "listByOwner">;
  readonly assessments: Pick<ApplicationAssessmentRepositoryPort, "findByApplicationId">;
}

export async function getAdminReviewContext(
  dependencies: GetAdminReviewContextDependencies,
  input: { readonly applicationId: ApplicationId }
): Promise<Awaited<ReturnType<AdminReviewContextPort["get"]>>> {
  try {
    const review = await dependencies.applicationReviews.findById(input.applicationId);
    if (!review.ok) {
      return { ok: false, error: { code: review.error.code === "not_found" ? "not_found" : "unavailable" } };
    }

    const smeRequest = await dependencies.smeRequests.findByApplicationId(input.applicationId);
    if (!smeRequest.ok) {
      return {
        ok: false,
        error: { code: smeRequest.error.code === "not_found" ? "not_found" : "unavailable" }
      };
    }

    // Legacy rows without ownership cannot be safely attributed to an ADMIN context.
    if (smeRequest.value.ownerUserId === undefined) {
      return { ok: false, error: { code: "unavailable" } };
    }

    const ownerUserId = smeRequest.value.ownerUserId;
    const [company, documents, assessment, latestHumanDecision] = await Promise.all([
      dependencies.businesses.findByOwner(ownerUserId),
      dependencies.documents.listByOwner(ownerUserId),
      dependencies.assessments.findByApplicationId(input.applicationId),
      dependencies.applicationReviews.readLatestHumanDecision(input.applicationId)
    ]);

    if (!company.ok && company.error.code !== "not_found") {
      return { ok: false, error: { code: "unavailable" } };
    }
    if (!documents.ok) {
      return { ok: false, error: { code: "unavailable" } };
    }
    if (!assessment.ok && assessment.error.code !== "not_found") {
      return { ok: false, error: { code: "unavailable" } };
    }
    if (!latestHumanDecision.ok && latestHumanDecision.error.code !== "not_found") {
      return { ok: false, error: { code: "unavailable" } };
    }

    return {
      ok: true,
      value: {
        applicationReview: review.value,
        smeRequest: { ...smeRequest.value, ownerUserId },
        company: company.ok ? company.value : null,
        documents: documents.ok
          ? documents.value.map(({ documentId, kind, objectPath, name, sizeBytes, contentType, createdAt }) => ({
              documentId,
              kind,
              objectPath,
              name,
              sizeBytes,
              contentType,
              createdAt
            }))
          : [],
        assessment: assessment.ok ? assessment.value : null,
        latestHumanDecision: latestHumanDecision.ok ? latestHumanDecision.value : null
      }
    };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}
