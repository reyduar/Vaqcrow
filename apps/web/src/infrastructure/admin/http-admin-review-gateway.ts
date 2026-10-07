import axios, { type AxiosInstance } from "axios";
import {
  applicationAssessmentReadSchema,
  applicationIdSchema,
  applicationReviewSnapshotSchema,
  applicationReviewStateSchema,
  documentVerdictRecordSchema,
  type DocumentVerdictValue,
  humanDecisionRecordSchema,
  pymeDocumentIdSchema,
  smeRequestSchema
} from "@vaqcrow/contracts";
import type {
  AdminReviewCompany,
  AdminReviewContext,
  AdminReviewDocument,
  AdminDocumentFileResult,
  AdminReviewPort,
  AdminReviewResult,
  RecordDecisionRequest,
  RecordDecisionResult,
  SetDocumentVerdictResult
} from "@/application/ports/admin-review-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the admin review context (Feature #410 / U2), talking to
 * `GET /application-reviews/:applicationId/context` (ADMIN-only) with the
 * signed-in session's `Authorization: Bearer` token.
 *
 * The shared contract schemas validate the review snapshot, SME request,
 * assessment, decision and verdicts; the company and document descriptors are
 * API-local shapes checked here. Any deviation collapses to `unavailable`
 * instead of rendering half a context. A 404 is `not_found`, every other
 * non-200 the sanitized `unavailable`, a transport failure `network`. An id the
 * API would reject (not a UUID v4) is `not_found` without a request.
 *
 * U3 adds the per-document verdict write (`PUT …/documents/:documentId/verdict`,
 * body exactly `{ verdict }`; the actor is the verified admin, never sent) and
 * the private viewer read (`GET /storage/uploads?path=`, bytes as a `Blob`,
 * never a public URL).
 *
 * U5 adds the human decision write (`POST …/decisions`, body exactly
 * `{ decisionId, outcome, reason, approvedLimitArs }`). The legacy
 * `http-human-decision-gateway.ts` sends an `actor` the API now refuses, so it
 * is not reused: the actor is the verified admin and is never sent.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : undefined;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseCompany(value: unknown): AdminReviewCompany | null | undefined {
  if (value === null) return null;
  const record = asRecord(value);
  if (!record) return undefined;
  const { name, cuit, sector, city, description, goalArs, revenueShare, deadline } = record;
  if (typeof name !== "string" || typeof cuit !== "string" || typeof sector !== "string") return undefined;
  if (typeof city !== "string" || typeof description !== "string") return undefined;
  if (typeof goalArs !== "number" || !Number.isFinite(goalArs)) return undefined;
  if (typeof revenueShare !== "number" || !Number.isFinite(revenueShare)) return undefined;
  if (deadline !== undefined && deadline !== null && typeof deadline !== "string") return undefined;
  return { name, cuit, sector, city, description, goalArs, revenueShare, deadline: deadline ?? null };
}

function parseDocument(value: unknown): AdminReviewDocument | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const { documentId, kind, objectPath, name, sizeBytes, contentType, createdAt } = record;
  if (typeof documentId !== "string" || documentId.length === 0) return undefined;
  if (typeof kind !== "string" || typeof objectPath !== "string" || typeof name !== "string") return undefined;
  if (!isNonNegativeInteger(sizeBytes)) return undefined;
  if (typeof contentType !== "string" || typeof createdAt !== "string") return undefined;
  return { documentId, kind, objectPath, name, sizeBytes, contentType, createdAt };
}

function parseList<T>(value: unknown, parse: (entry: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed: T[] = [];
  for (const entry of value) {
    const item = parse(entry);
    if (item === undefined) return undefined;
    parsed.push(item);
  }
  return parsed;
}

function nullableWith<T>(value: unknown, schema: { safeParse(input: unknown): { success: boolean; data?: T } }) {
  if (value === null) return { ok: true as const, value: null };
  const result = schema.safeParse(value);
  return result.success ? { ok: true as const, value: result.data as T } : { ok: false as const };
}

/** The `{ applicationReview, smeRequest, company, … }` envelope; any deviation is `undefined`. */
function parseContext(data: unknown, applicationId: string): AdminReviewContext | undefined {
  const record = asRecord(data);
  if (!record) return undefined;

  const review = applicationReviewSnapshotSchema.safeParse(record["applicationReview"]);
  if (!review.success || review.data.applicationId !== applicationId) return undefined;

  const smeRequest = smeRequestSchema.safeParse(asRecord(record["smeRequest"])?.["request"]);
  if (!smeRequest.success) return undefined;

  const company = parseCompany(record["company"]);
  if (company === undefined) return undefined;

  const documents = parseList(record["documents"], parseDocument);
  if (!documents) return undefined;

  const documentVerdicts = parseList(record["documentVerdicts"], (entry) => {
    const verdict = documentVerdictRecordSchema.safeParse(entry);
    return verdict.success ? verdict.data : undefined;
  });
  if (!documentVerdicts) return undefined;

  const assessment = nullableWith(record["assessment"], applicationAssessmentReadSchema);
  if (!assessment.ok) return undefined;

  const latestHumanDecision = nullableWith(record["latestHumanDecision"], humanDecisionRecordSchema);
  if (!latestHumanDecision.ok) return undefined;

  return {
    applicationId: review.data.applicationId,
    state: review.data.state,
    smeRequest: smeRequest.data,
    company,
    documents,
    documentVerdicts,
    assessment: assessment.value,
    latestHumanDecision: latestHumanDecision.value
  };
}

/** The `200 { applied, verdict }` body for the document that was written; any deviation is `undefined`. */
function parseVerdictWrite(data: unknown, documentId: string): SetDocumentVerdictResult | undefined {
  const record = asRecord(data);
  if (!record || typeof record["applied"] !== "boolean") return undefined;
  const verdict = documentVerdictRecordSchema.safeParse(record["verdict"]);
  if (!verdict.success || verdict.data.documentId !== documentId) return undefined;
  return { ok: true, applied: record["applied"], verdict: verdict.data };
}

/** The `{ applied, decision }` body for the decision that was sent; any deviation is `undefined`. */
function parseDecisionWrite(
  data: unknown,
  applicationId: string,
  decisionId: string
): RecordDecisionResult | undefined {
  const record = asRecord(data);
  if (!record || typeof record["applied"] !== "boolean") return undefined;
  const decision = humanDecisionRecordSchema.safeParse(record["decision"]);
  if (!decision.success) return undefined;
  if (decision.data.applicationId !== applicationId || decision.data.decisionId !== decisionId) return undefined;
  return { ok: true, applied: record["applied"], decision: decision.data };
}

/** A 409 is either a state conflict with a known state or an idempotency conflict; anything else is `unavailable`. */
function parseDecisionConflict(data: unknown): RecordDecisionResult {
  const record = asRecord(data);
  if (record?.["code"] === "idempotency_conflict") return { ok: false, code: "idempotency_conflict" };
  const actualState = applicationReviewStateSchema.safeParse(record?.["actualState"]);
  return record?.["code"] === "state_conflict" && actualState.success
    ? { ok: false, code: "state_conflict", actualState: actualState.data }
    : { ok: false, code: "unavailable" };
}

async function headersFor(provider: AccessTokenProvider | undefined): Promise<Record<string, string> | undefined> {
  if (!provider) return undefined;
  let token: string | null;
  try {
    token = await provider();
  } catch {
    return undefined;
  }
  return typeof token === "string" && BEARER_TOKEN_PATTERN.test(token) ? { Authorization: `Bearer ${token}` } : undefined;
}

export class HttpAdminReviewGateway implements AdminReviewPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpAdminReviewGateway {
    return new HttpAdminReviewGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async getContext(applicationId: string): Promise<AdminReviewResult> {
    if (!applicationIdSchema.safeParse(applicationId).success) return { ok: false, code: "not_found" };
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get(`/application-reviews/${encodeURIComponent(applicationId)}/context`, {
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status === 404) return { ok: false, code: "not_found" };
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      const context = parseContext(response.data, applicationId);
      return context ? { ok: true, context } : { ok: false, code: "unavailable" };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async setDocumentVerdict(
    applicationId: string,
    documentId: string,
    verdict: DocumentVerdictValue
  ): Promise<SetDocumentVerdictResult> {
    if (!applicationIdSchema.safeParse(applicationId).success || !pymeDocumentIdSchema.safeParse(documentId).success) {
      return { ok: false, code: "not_found" };
    }
    const headers = await headersFor(this.accessToken);
    const url = `/application-reviews/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentId)}/verdict`;
    try {
      const response = await this.client.put(url, { verdict }, { ...(headers ? { headers } : {}), validateStatus: () => true });
      if (response.status === 404) return { ok: false, code: "not_found" };
      if (response.status === 409) {
        const actualState = applicationReviewStateSchema.safeParse(asRecord(response.data)?.["actualState"]);
        return actualState.success
          ? { ok: false, code: "state_conflict", actualState: actualState.data }
          : { ok: false, code: "unavailable" };
      }
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      return parseVerdictWrite(response.data, documentId) ?? { ok: false, code: "unavailable" };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async recordDecision(applicationId: string, request: RecordDecisionRequest): Promise<RecordDecisionResult> {
    if (!applicationIdSchema.safeParse(applicationId).success) return { ok: false, code: "not_found" };
    const headers = await headersFor(this.accessToken);
    // Rebuilt key by key so nothing but the four contract keys ever travels.
    const body = {
      decisionId: request.decisionId,
      outcome: request.outcome,
      reason: request.reason,
      approvedLimitArs: request.approvedLimitArs
    };
    try {
      const response = await this.client.post(`/application-reviews/${encodeURIComponent(applicationId)}/decisions`, body, {
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status === 200 || response.status === 201) {
        return parseDecisionWrite(response.data, applicationId, request.decisionId) ?? { ok: false, code: "unavailable" };
      }
      if (response.status === 409) return parseDecisionConflict(response.data);
      if (response.status === 400) return { ok: false, code: "invalid_request" };
      if (response.status === 404) return { ok: false, code: "not_found" };
      return { ok: false, code: "unavailable" };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async downloadDocument(objectPath: string): Promise<AdminDocumentFileResult> {
    if (objectPath.trim().length === 0) return { ok: false, code: "unavailable" };
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/storage/uploads", {
        params: { path: objectPath },
        responseType: "blob",
        ...(headers ? { headers } : {}),
        validateStatus: () => true
      });
      if (response.status !== 200 || !(response.data instanceof Blob)) return { ok: false, code: "unavailable" };
      return { ok: true, file: response.data };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}
