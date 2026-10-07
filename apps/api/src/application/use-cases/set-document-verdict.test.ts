import { parseApplicationId } from "@vaqcrow/contracts";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { PymeDocumentRecord } from "../ports/pyme-document-repository-port.js";
import type { SmeRequestRecord } from "../ports/sme-request-repository-port.js";
import { setDocumentVerdict } from "./set-document-verdict.js";

const APPLICATION_ID = parseApplicationId("22222222-2222-4222-8222-222222222222");
const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const DOCUMENT_ID = "55555555-5555-4555-8555-555555555555";
const ADMIN = { userId: "00000000-0000-4000-8000-000000000005", displayName: "Admin Vaqcrow" };

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

const DOCUMENT: PymeDocumentRecord = {
  documentId: DOCUMENT_ID,
  ownerUserId: OWNER_ID,
  kind: "cuit",
  objectPath: `${OWNER_ID}/cuit/${DOCUMENT_ID}-cuit.pdf`,
  name: "cuit.pdf",
  sizeBytes: 1024,
  contentType: "application/pdf",
  createdAt: "2026-10-07T11:00:00.000Z"
};

const OUTCOME = {
  applied: true,
  verdict: { documentId: DOCUMENT_ID, verdict: "request", actor: ADMIN.displayName, updatedAt: "2026-10-07T12:00:00.000Z" }
} as const;

function dependencies(state: ApplicationReviewState = "human_review", overrides: Record<string, unknown> = {}) {
  return {
    applicationReviews: {
      findById: vi.fn().mockResolvedValue({ ok: true, value: { applicationId: APPLICATION_ID, state } })
    },
    smeRequests: {
      findByApplicationId: vi.fn().mockResolvedValue({ ok: true, value: SME_REQUEST })
    },
    documents: {
      listByOwner: vi.fn().mockResolvedValue({ ok: true, value: [DOCUMENT] })
    },
    verdicts: {
      setVerdict: vi.fn().mockResolvedValue({ ok: true, value: OUTCOME })
    },
    ...overrides
  };
}

const INPUT = { applicationId: APPLICATION_ID, documentId: DOCUMENT_ID, verdict: "request", actor: ADMIN } as const;

describe("setDocumentVerdict", () => {
  it.each(["awaiting_assessment", "human_review"] as const)(
    "records the verdict attributed to the verified admin while the review is %s",
    async (state) => {
      const deps = dependencies(state);

      const result = await setDocumentVerdict(deps, INPUT);

      expect(result).toEqual({ ok: true, value: OUTCOME });
      expect(deps.documents.listByOwner).toHaveBeenCalledWith(OWNER_ID);
      expect(deps.verdicts.setVerdict).toHaveBeenCalledExactlyOnceWith({
        applicationId: APPLICATION_ID,
        documentId: DOCUMENT_ID,
        verdict: "request",
        actor: ADMIN.displayName,
        actorUserId: ADMIN.userId
      });
    }
  );

  it("passes a no-op replay through unchanged", async () => {
    const replay = { ...OUTCOME, applied: false };
    const deps = dependencies("human_review", {
      verdicts: { setVerdict: vi.fn().mockResolvedValue({ ok: true, value: replay }) }
    });

    await expect(setDocumentVerdict(deps, INPUT)).resolves.toEqual({ ok: true, value: replay });
  });

  it.each(["draft", "approved", "changes_requested", "rejected"] as const)(
    "refuses an edit once the review is %s, reporting the actual state and writing nothing",
    async (state) => {
      const deps = dependencies(state);

      const result = await setDocumentVerdict(deps, INPUT);

      expect(result).toEqual({ ok: false, error: { code: "state_conflict", actualState: state } });
      expect(deps.verdicts.setVerdict).not.toHaveBeenCalled();
    }
  );

  it("refuses a document that does not belong to the application's owner", async () => {
    const foreign = { ...DOCUMENT, documentId: "99999999-9999-4999-8999-999999999999" };
    const deps = dependencies("human_review", {
      documents: { listByOwner: vi.fn().mockResolvedValue({ ok: true, value: [foreign] }) }
    });

    const result = await setDocumentVerdict(deps, INPUT);

    expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    expect(deps.verdicts.setVerdict).not.toHaveBeenCalled();
  });

  it.each([
    ["the application review", { applicationReviews: { findById: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) } }],
    ["the SME request", { smeRequests: { findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) } }],
    ["the verdict row's references", { verdicts: { setVerdict: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) } }]
  ])("maps a missing %s to not_found", async (_label, override) => {
    const deps = dependencies("human_review", override);

    await expect(setDocumentVerdict(deps, INPUT)).resolves.toEqual({ ok: false, error: { code: "not_found" } });
  });

  it.each([
    ["applicationReviews", { findById: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) }],
    ["smeRequests", { findByApplicationId: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) }],
    ["documents", { listByOwner: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) }],
    ["verdicts", { setVerdict: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) }],
    ["verdicts", { setVerdict: vi.fn().mockRejectedValue(new Error("raw database detail")) }]
  ])("maps a failing %s dependency to unavailable", async (dependency, methods) => {
    const deps = dependencies("human_review", { [dependency]: methods });

    const result = await setDocumentVerdict(deps, INPUT);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("raw database detail");
  });

  it("fails closed when the persisted owner is absent", async () => {
    const deps = dependencies("human_review", {
      smeRequests: {
        findByApplicationId: vi.fn().mockResolvedValue({ ok: true, value: { ...SME_REQUEST, ownerUserId: undefined } })
      }
    });

    await expect(setDocumentVerdict(deps, INPUT)).resolves.toEqual({ ok: false, error: { code: "unavailable" } });
    expect(deps.documents.listByOwner).not.toHaveBeenCalled();
  });
});
