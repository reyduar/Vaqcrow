import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpAdminReviewGateway } from "./http-admin-review-gateway";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "55555555-5555-4555-8555-555555555555";

const COMPANY = {
  businessId: "33333333-3333-4333-8333-333333333333",
  ownerUserId: "00000000-0000-4000-8000-000000000001",
  name: "Panadería Horizonte SRL",
  cuit: "30-71234567-8",
  sector: "Alimentos",
  city: "Rosario",
  description: "Panadería de barrio con dos sucursales.",
  goalArs: 12_000_000,
  revenueShare: 5,
  deadline: null,
  createdAt: "2026-09-10T12:00:00.000Z",
  updatedAt: "2026-09-11T12:00:00.000Z"
};

const DOCUMENT = {
  documentId: DOCUMENT_ID,
  kind: "cuit",
  objectPath: "00000000-0000-4000-8000-000000000001/cuit/abc-constancia.pdf",
  name: "constancia.pdf",
  sizeBytes: 2048,
  contentType: "application/pdf",
  createdAt: "2026-09-11T12:00:00.000Z"
};

const VERDICT = {
  documentId: DOCUMENT_ID,
  verdict: "valid",
  actor: "Admin Vaqcrow",
  updatedAt: "2026-10-07T12:00:00.000Z"
};

const ASSESSMENT = {
  assessment: {
    assessmentId: "asm_001",
    riskBand: "medium",
    confidence: 0.72,
    reasons: [{ claim: "Ventas estables.", evidenceRefs: ["sales-2026-01"] }],
    anomalies: [{ type: "outlier", evidenceRef: "sales-2026-06", severity: "review" }],
    missingData: ["Declaración de abril 2026"],
    recommendedAction: "human_review",
    questions: ["¿Qué explica el pico de junio?"]
  },
  metadata: {
    model: "evaluador-v1",
    promptVersion: "v1",
    generatedAt: "2026-09-12T10:42:00.000Z",
    source: "simulated"
  },
  recordedAt: "2026-09-12T10:42:05.000Z"
};

const DECISION = {
  decisionId: "44444444-4444-4444-8444-444444444444",
  applicationId: APPLICATION_ID,
  outcome: "changes_requested",
  actor: "Admin Vaqcrow",
  reason: "Falta la declaración de abril.",
  approvedLimitArs: null,
  decidedAt: "2026-09-13T09:00:00.000Z",
  correlationId: "66666666-6666-4666-8666-666666666666"
};

const SME_REQUEST = {
  smeReference: "sme-001",
  declaredTotalArs: 1_500_000,
  periodStart: "2026-01",
  periodEnd: "2026-06",
  simuladoLabel: "SIMULADO"
};

const WIRE_CONTEXT = {
  applicationReview: { applicationId: APPLICATION_ID, state: "human_review" },
  smeRequest: {
    applicationId: APPLICATION_ID,
    ownerUserId: "00000000-0000-4000-8000-000000000001",
    request: SME_REQUEST
  },
  company: COMPANY,
  documents: [DOCUMENT],
  assessment: ASSESSMENT,
  latestHumanDecision: DECISION,
  documentVerdicts: [VERDICT]
};

interface Call {
  readonly url: string;
  readonly headers: Record<string, string> | undefined;
}

function fakeClient(result: { status: number; data: unknown } | Error) {
  const calls: Call[] = [];
  const client = {
    get: async (url: string, config: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: config.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HttpAdminReviewGateway.getContext", () => {
  it("maps the context with the Bearer token, verdicts included and the owner id dropped", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE_CONTEXT });
    const gateway = new HttpAdminReviewGateway(client, async () => "token-123");

    const result = await gateway.getContext(APPLICATION_ID);

    expect(calls[0]!.url).toBe(`/application-reviews/${APPLICATION_ID}/context`);
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
    expect(result).toEqual({
      ok: true,
      context: {
        applicationId: APPLICATION_ID,
        state: "human_review",
        smeRequest: SME_REQUEST,
        company: {
          name: COMPANY.name,
          cuit: COMPANY.cuit,
          sector: COMPANY.sector,
          city: COMPANY.city,
          description: COMPANY.description,
          goalArs: COMPANY.goalArs,
          revenueShare: COMPANY.revenueShare,
          deadline: null
        },
        documents: [DOCUMENT],
        documentVerdicts: [VERDICT],
        assessment: ASSESSMENT,
        latestHumanDecision: DECISION
      }
    });
    expect(JSON.stringify(result)).not.toContain("ownerUserId");
  });

  it("keeps the nullable sections null", async () => {
    const { client } = fakeClient({
      status: 200,
      data: { ...WIRE_CONTEXT, company: null, assessment: null, latestHumanDecision: null, documents: [], documentVerdicts: [] }
    });
    const result = await new HttpAdminReviewGateway(client).getContext(APPLICATION_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.company).toBeNull();
    expect(result.context.assessment).toBeNull();
    expect(result.context.latestHumanDecision).toBeNull();
    expect(result.context.documents).toEqual([]);
    expect(result.context.documentVerdicts).toEqual([]);
  });

  it("treats a company without a deadline field as no deadline", async () => {
    const withoutDeadline: Record<string, unknown> = { ...COMPANY };
    delete withoutDeadline["deadline"];
    const { client } = fakeClient({ status: 200, data: { ...WIRE_CONTEXT, company: withoutDeadline } });
    const result = await new HttpAdminReviewGateway(client).getContext(APPLICATION_ID);

    expect(result.ok && result.context.company?.deadline).toBeNull();
  });

  it("sends no Authorization header without a token provider", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE_CONTEXT });
    await new HttpAdminReviewGateway(client).getContext(APPLICATION_ID);
    expect(calls[0]!.headers).toBeUndefined();
  });

  it("never puts a malformed token in a header", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE_CONTEXT });
    await new HttpAdminReviewGateway(client, async () => "bad token\r\nX: 1").getContext(APPLICATION_ID);
    expect(calls[0]!.headers).toBeUndefined();
  });

  it("maps 404 to not_found", async () => {
    const { client } = fakeClient({ status: 404, data: { code: "not_found" } });
    expect(await new HttpAdminReviewGateway(client).getContext(APPLICATION_ID)).toEqual({ ok: false, code: "not_found" });
  });

  it("treats an id the API would never accept as not_found without a request", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE_CONTEXT });
    expect(await new HttpAdminReviewGateway(client).getContext("not-an-id")).toEqual({ ok: false, code: "not_found" });
    expect(calls).toHaveLength(0);
  });

  it.each([500, 503, 403, 400])("maps %s to unavailable", async (status) => {
    const { client } = fakeClient({ status, data: { code: "unavailable", message: "leak" } });
    expect(await new HttpAdminReviewGateway(client).getContext(APPLICATION_ID)).toEqual({ ok: false, code: "unavailable" });
  });

  it.each([
    ["a non-object body", "oops"],
    ["an unknown review state", { ...WIRE_CONTEXT, applicationReview: { applicationId: APPLICATION_ID, state: "teleported" } }],
    ["a malformed verdict", { ...WIRE_CONTEXT, documentVerdicts: [{ ...VERDICT, verdict: "maybe" }] }],
    ["missing verdicts", { ...WIRE_CONTEXT, documentVerdicts: undefined }],
    ["a malformed document", { ...WIRE_CONTEXT, documents: [{ ...DOCUMENT, sizeBytes: "big" }] }],
    ["a malformed company", { ...WIRE_CONTEXT, company: { ...COMPANY, goalArs: "mucho" } }],
    ["a malformed assessment", { ...WIRE_CONTEXT, assessment: { ...ASSESSMENT, recordedAt: "ayer" } }],
    ["a malformed decision", { ...WIRE_CONTEXT, latestHumanDecision: { ...DECISION, outcome: "maybe" } }],
    ["a malformed sme request", { ...WIRE_CONTEXT, smeRequest: { ...WIRE_CONTEXT.smeRequest, request: { smeReference: "" } } }],
    ["a context for another application", { ...WIRE_CONTEXT, applicationReview: { applicationId: DECISION.correlationId, state: "human_review" } }]
  ])("collapses %s to unavailable", async (_label, data) => {
    const { client } = fakeClient({ status: 200, data });
    expect(await new HttpAdminReviewGateway(client).getContext(APPLICATION_ID)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a thrown transport to network", async () => {
    const { client } = fakeClient(new Error("ECONNREFUSED"));
    expect(await new HttpAdminReviewGateway(client).getContext(APPLICATION_ID)).toEqual({ ok: false, code: "network" });
  });
});

interface WriteCall {
  readonly url: string;
  readonly body: unknown;
  readonly headers: Record<string, string> | undefined;
}

function fakeWriteClient(result: { status: number; data: unknown } | Error) {
  const calls: WriteCall[] = [];
  const client = {
    put: async (url: string, body: unknown, config: { headers?: Record<string, string> }) => {
      calls.push({ url, body, headers: config.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HttpAdminReviewGateway.setDocumentVerdict", () => {
  const verdictUrl = `/application-reviews/${APPLICATION_ID}/documents/${DOCUMENT_ID}/verdict`;

  it("PUTs exactly { verdict } with the Bearer token and maps the persisted record", async () => {
    const { client, calls } = fakeWriteClient({ status: 200, data: { applied: true, verdict: VERDICT } });
    const gateway = new HttpAdminReviewGateway(client, async () => "token-123");

    const result = await gateway.setDocumentVerdict(APPLICATION_ID, DOCUMENT_ID, "valid");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(verdictUrl);
    expect(calls[0]!.body).toStrictEqual({ verdict: "valid" });
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
    expect(result).toEqual({ ok: true, applied: true, verdict: VERDICT });
  });

  it("keeps applied: false for an idempotent replay", async () => {
    const { client } = fakeWriteClient({ status: 200, data: { applied: false, verdict: VERDICT } });
    expect(await new HttpAdminReviewGateway(client).setDocumentVerdict(APPLICATION_ID, DOCUMENT_ID, "valid")).toEqual({
      ok: true,
      applied: false,
      verdict: VERDICT
    });
  });

  it("maps 404 to not_found", async () => {
    const { client } = fakeWriteClient({ status: 404, data: { code: "not_found" } });
    expect(await new HttpAdminReviewGateway(client).setDocumentVerdict(APPLICATION_ID, DOCUMENT_ID, "request")).toEqual({
      ok: false,
      code: "not_found"
    });
  });

  it("maps 409 to state_conflict with the actual state", async () => {
    const { client } = fakeWriteClient({ status: 409, data: { code: "state_conflict", actualState: "approved" } });
    expect(await new HttpAdminReviewGateway(client).setDocumentVerdict(APPLICATION_ID, DOCUMENT_ID, "invalid")).toEqual({
      ok: false,
      code: "state_conflict",
      actualState: "approved"
    });
  });

  it("collapses a 409 without a known actual state to unavailable", async () => {
    const { client } = fakeWriteClient({ status: 409, data: { code: "state_conflict", actualState: "teleported" } });
    expect(await new HttpAdminReviewGateway(client).setDocumentVerdict(APPLICATION_ID, DOCUMENT_ID, "valid")).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it.each([503, 500, 400, 403])("maps %s to unavailable without leaking the body", async (status) => {
    const { client } = fakeWriteClient({ status, data: { code: "unavailable", message: "leak" } });
    expect(await new HttpAdminReviewGateway(client).setDocumentVerdict(APPLICATION_ID, DOCUMENT_ID, "valid")).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it.each([
    ["a missing verdict", { applied: true }],
    ["a verdict for another document", { applied: true, verdict: { ...VERDICT, documentId: APPLICATION_ID } }],
    ["a non-boolean applied", { applied: "yes", verdict: VERDICT }]
  ])("collapses %s to unavailable", async (_label, data) => {
    const { client } = fakeWriteClient({ status: 200, data });
    expect(await new HttpAdminReviewGateway(client).setDocumentVerdict(APPLICATION_ID, DOCUMENT_ID, "valid")).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("treats ids the API would never accept as not_found without a request", async () => {
    const { client, calls } = fakeWriteClient({ status: 200, data: { applied: true, verdict: VERDICT } });
    const gateway = new HttpAdminReviewGateway(client);
    expect(await gateway.setDocumentVerdict("nope", DOCUMENT_ID, "valid")).toEqual({ ok: false, code: "not_found" });
    expect(await gateway.setDocumentVerdict(APPLICATION_ID, "nope", "valid")).toEqual({ ok: false, code: "not_found" });
    expect(calls).toHaveLength(0);
  });

  it("maps a thrown transport to network", async () => {
    const { client } = fakeWriteClient(new Error("ECONNREFUSED"));
    expect(await new HttpAdminReviewGateway(client).setDocumentVerdict(APPLICATION_ID, DOCUMENT_ID, "valid")).toEqual({
      ok: false,
      code: "network"
    });
  });
});

interface DownloadCall {
  readonly url: string;
  readonly params: unknown;
  readonly responseType: unknown;
  readonly headers: Record<string, string> | undefined;
}

function fakeDownloadClient(result: { status: number; data: unknown } | Error) {
  const calls: DownloadCall[] = [];
  const client = {
    get: async (
      url: string,
      config: { params?: unknown; responseType?: unknown; headers?: Record<string, string> }
    ) => {
      calls.push({ url, params: config.params, responseType: config.responseType, headers: config.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HttpAdminReviewGateway.downloadDocument", () => {
  it("fetches the private object as a blob through the ADMIN endpoint with the Bearer token", async () => {
    const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    const { client, calls } = fakeDownloadClient({ status: 200, data: blob });
    const gateway = new HttpAdminReviewGateway(client, async () => "token-123");

    const result = await gateway.downloadDocument(DOCUMENT.objectPath);

    expect(calls).toEqual([
      {
        url: "/storage/uploads",
        params: { path: DOCUMENT.objectPath },
        responseType: "blob",
        headers: { Authorization: "Bearer token-123" }
      }
    ]);
    expect(result).toEqual({ ok: true, file: blob });
  });

  it.each([404, 400, 403, 503])("maps %s to unavailable", async (status) => {
    const { client } = fakeDownloadClient({ status, data: new Blob(['{"code":"not_found"}']) });
    expect(await new HttpAdminReviewGateway(client).downloadDocument(DOCUMENT.objectPath)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("collapses a non-blob body to unavailable", async () => {
    const { client } = fakeDownloadClient({ status: 200, data: "not bytes" });
    expect(await new HttpAdminReviewGateway(client).downloadDocument(DOCUMENT.objectPath)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("never sends a request for an empty path", async () => {
    const { client, calls } = fakeDownloadClient({ status: 200, data: new Blob([]) });
    expect(await new HttpAdminReviewGateway(client).downloadDocument("  ")).toEqual({ ok: false, code: "unavailable" });
    expect(calls).toHaveLength(0);
  });

  it("maps a thrown transport to network", async () => {
    const { client } = fakeDownloadClient(new Error("ECONNREFUSED"));
    expect(await new HttpAdminReviewGateway(client).downloadDocument(DOCUMENT.objectPath)).toEqual({
      ok: false,
      code: "network"
    });
  });
});
