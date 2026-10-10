import {
  parseApplicationAssessmentRead,
  parseApplicationId,
  parseHumanDecisionRecord
} from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationReviewSnapshot } from "@vaqcrow/contracts";
import type { BusinessRecord } from "../ports/business-repository-port.js";
import type { PymeDocumentRecord } from "../ports/pyme-document-repository-port.js";
import type { SmeRequestRecord } from "../ports/sme-request-repository-port.js";
import { getAdminReviewContext } from "./get-admin-review-context.js";

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const REVIEW: ApplicationReviewSnapshot = { applicationId: APPLICATION_ID, state: "human_review" };
const SME_REQUEST: SmeRequestRecord = {
  applicationId: APPLICATION_ID,
  ownerUserId: OWNER_ID,
  request: {
    smeReference: "sme-001",
    declaredTotalArs: 1_500_000,
    periodStart: "2026-01",
    periodEnd: "2026-06",
    simuladoLabel: "SIMULADO"
  }
};
const COMPANY: BusinessRecord = {
  businessId: "44444444-4444-4444-8444-444444444444",
  ownerUserId: OWNER_ID,
  name: "Almacén Demo",
  cuit: "20-12345678-9",
  sector: "Comercio",
  city: "Rosario",
  description: "Empresa sintética",
  goalArs: 2_000_000,
  revenueShare: 8,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z"
};
const DOCUMENT: PymeDocumentRecord = {
  documentId: "55555555-5555-4555-8555-555555555555",
  ownerUserId: OWNER_ID,
  kind: "cuit",
  objectPath: `${OWNER_ID}/cuit/${"55555555-5555-4555-8555-555555555555"}-cuit.pdf`,
  name: "cuit.pdf",
  sizeBytes: 1024,
  contentType: "application/pdf",
  createdAt: "2026-09-01T12:01:00.000Z"
};
const ASSESSMENT = parseApplicationAssessmentRead({
  assessment: {
    assessmentId: "asm_demo",
    riskBand: "medium",
    confidence: 0.8,
    reasons: [{ claim: "Ventas consistentes", evidenceRefs: ["sales:2026-01"] }],
    anomalies: [],
    missingData: [],
    recommendedAction: "human_review",
    questions: []
  },
  metadata: {
    model: "simulated-underwriter",
    promptVersion: "prompt-v1",
    generatedAt: "2026-09-01T12:02:00.000Z",
    source: "simulated"
  },
  recordedAt: "2026-09-01T12:02:00.000Z"
});
const DECISION = parseHumanDecisionRecord({
  decisionId: "66666666-6666-4666-8666-666666666666",
  applicationId: APPLICATION_ID,
  outcome: "approved",
  actor: "Admin Vaqcrow",
  reason: "La documentación es consistente.",
  approvedLimitArs: 1_500_000,
  decidedAt: "2026-09-01T12:03:00.000Z",
  correlationId: "77777777-7777-4777-8777-777777777777"
});
const VERDICT = {
  documentId: DOCUMENT.documentId,
  verdict: "request",
  actor: "Admin Vaqcrow",
  updatedAt: "2026-09-01T12:04:00.000Z"
} as const;

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    applicationReviews: {
      findById: vi.fn().mockResolvedValue({ ok: true, value: REVIEW }),
      readLatestHumanDecision: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    },
    smeRequests: {
      findByApplicationId: vi.fn().mockResolvedValue({ ok: true, value: SME_REQUEST })
    },
    businesses: {
      findByOwner: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    },
    documents: {
      listByOwner: vi.fn().mockResolvedValue({ ok: true, value: [] })
    },
    assessments: {
      findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    },
    verdicts: {
      listByApplication: vi.fn().mockResolvedValue({ ok: true, value: [] })
    },
    ...overrides
  };
}

describe("getAdminReviewContext", () => {
  it("aggregates the authoritative records and preserves legitimate absences", async () => {
    const deps = dependencies();

    const result = await getAdminReviewContext(deps, { applicationId: APPLICATION_ID });

    expect(result).toEqual({
      ok: true,
      value: {
        applicationReview: REVIEW,
        smeRequest: SME_REQUEST,
        company: null,
        documents: [],
        assessment: null,
        latestHumanDecision: null,
        documentVerdicts: []
      }
    });
    expect(deps.businesses.findByOwner).toHaveBeenCalledWith(OWNER_ID);
    expect(deps.documents.listByOwner).toHaveBeenCalledWith(OWNER_ID);
    expect(deps.verdicts.listByApplication).toHaveBeenCalledWith(APPLICATION_ID);
  });

  it("includes the company, document descriptors, assessment, and latest decision when present", async () => {
    const deps = dependencies({
      businesses: { findByOwner: vi.fn().mockResolvedValue({ ok: true, value: COMPANY }) },
      documents: { listByOwner: vi.fn().mockResolvedValue({ ok: true, value: [DOCUMENT] }) },
      assessments: { findByApplicationId: vi.fn().mockResolvedValue({ ok: true, value: ASSESSMENT }) },
      verdicts: { listByApplication: vi.fn().mockResolvedValue({ ok: true, value: [VERDICT] }) },
      applicationReviews: {
        findById: vi.fn().mockResolvedValue({ ok: true, value: REVIEW }),
        readLatestHumanDecision: vi.fn().mockResolvedValue({ ok: true, value: DECISION })
      }
    });

    const result = await getAdminReviewContext(deps, { applicationId: APPLICATION_ID });

    expect(result).toEqual({
      ok: true,
      value: {
        applicationReview: REVIEW,
        smeRequest: SME_REQUEST,
        company: COMPANY,
        documents: [
          {
            documentId: DOCUMENT.documentId,
            kind: DOCUMENT.kind,
            objectPath: DOCUMENT.objectPath,
            name: DOCUMENT.name,
            sizeBytes: DOCUMENT.sizeBytes,
            contentType: DOCUMENT.contentType,
            createdAt: DOCUMENT.createdAt
          }
        ],
        assessment: ASSESSMENT,
        latestHumanDecision: DECISION,
        documentVerdicts: [VERDICT]
      }
    });
  });

  it.each(["applicationReviews", "smeRequests"])("maps a missing %s to not_found", async (dependency) => {
    const key = dependency === "applicationReviews" ? "findById" : "findByApplicationId";
    const deps = dependencies({
      [dependency]: { [key]: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) }
    });

    await expect(getAdminReviewContext(deps, { applicationId: APPLICATION_ID })).resolves.toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it.each(["applicationReviews", "smeRequests", "businesses", "documents", "assessments", "verdicts"])(
    "maps unavailable dependency %s to unavailable",
    async (dependency) => {
      const methods = dependency === "applicationReviews" ? { findById: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) } :
        dependency === "smeRequests" ? { findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) } :
        dependency === "businesses" ? { findByOwner: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) } :
        dependency === "documents" ? { listByOwner: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) } :
        dependency === "verdicts" ? { listByApplication: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) } :
        { findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) };
      const deps = dependencies({ [dependency]: methods });

      await expect(getAdminReviewContext(deps, { applicationId: APPLICATION_ID })).resolves.toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }
  );

  it("fails closed when the persisted owner is absent", async () => {
    const deps = dependencies({
      smeRequests: {
        findByApplicationId: vi.fn().mockResolvedValue({
          ok: true,
          value: { ...SME_REQUEST, ownerUserId: undefined }
        })
      }
    });

    await expect(getAdminReviewContext(deps, { applicationId: APPLICATION_ID })).resolves.toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});
