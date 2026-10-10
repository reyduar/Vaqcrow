import axios, { type AxiosInstance } from "axios";
import {
  BUSINESS_ERROR_CODES,
  type BusinessDraft,
  type BusinessErrorCode,
  type BusinessPort,
  type BusinessRecord,
  type BusinessResult
} from "@/application/ports/business-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the PyME company (Feature #398, Task #399 / T3c).
 *
 * It talks to `POST /businesses` and `GET /businesses/mine` with the
 * signed-in session's `Authorization: Bearer` token. The owner is resolved by
 * the API from that token, so this adapter never sends one: the body is exactly
 * the draft's seven fields.
 *
 * Failures are the sanitized `{ code }` the API sends, a status-derived code,
 * or `network` when the transport itself fails — provider messages and response
 * bodies never cross this boundary. A dedicated axios client is used (like the
 * upload adapter) so a malformed success body collapses to `unavailable`.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

function isBusinessErrorCode(value: unknown): value is BusinessErrorCode {
  return typeof value === "string" && (BUSINESS_ERROR_CODES as readonly string[]).includes(value);
}

/** The identifier-shaped `code` of the API's `{ code }` envelope, or `undefined`. */
function codeFromEnvelope(data: unknown): BusinessErrorCode | undefined {
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  const code = (data as { code: unknown }).code;
  return isBusinessErrorCode(code) ? code : undefined;
}

function codeForStatus(status: number, data: unknown): BusinessErrorCode {
  const envelope = codeFromEnvelope(data);
  if (envelope) return envelope;
  if (status === 400) return "invalid_request";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  return "unavailable";
}

async function headersFor(provider: AccessTokenProvider | undefined): Promise<Record<string, string>> {
  if (!provider) return {};
  let token: string | null;
  try {
    token = await provider();
  } catch {
    return {};
  }
  return typeof token === "string" && BEARER_TOKEN_PATTERN.test(token) ? { Authorization: `Bearer ${token}` } : {};
}

const DURATIONS: readonly (30 | 60 | 90)[] = [30, 60, 90];

/** Narrows the `{ business }` envelope to a record; anything malformed is `undefined`. */
function parseBusiness(data: unknown): BusinessRecord | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const candidate = (data as { business?: unknown }).business;
  if (typeof candidate !== "object" || candidate === null) return undefined;

  const {
    businessId,
    ownerUserId,
    name,
    cuit,
    sector,
    city,
    description,
    goalArs,
    revenueShare,
    campaignDurationDays,
    createdAt,
    updatedAt
  } = candidate as Record<string, unknown>;

  if (typeof businessId !== "string" || businessId.length === 0) return undefined;
  if (typeof ownerUserId !== "string") return undefined;
  if (typeof name !== "string" || typeof cuit !== "string" || typeof sector !== "string") return undefined;
  if (typeof city !== "string" || typeof description !== "string") return undefined;
  if (typeof goalArs !== "number" || !Number.isFinite(goalArs)) return undefined;
  if (typeof revenueShare !== "number" || !Number.isFinite(revenueShare)) return undefined;
  if (typeof createdAt !== "string" || typeof updatedAt !== "string") return undefined;
  // #410/U13: absent/null for a company registered before the wizard captured
  // it; any value other than 30, 60 or 90 is a malformed body.
  const duration = DURATIONS.find((days) => days === campaignDurationDays);
  if (campaignDurationDays !== undefined && campaignDurationDays !== null && duration === undefined) return undefined;

  return {
    businessId,
    ownerUserId,
    name,
    cuit,
    sector,
    city,
    description,
    goalArs,
    revenueShare,
    ...(duration === undefined ? {} : { campaignDurationDays: duration }),
    createdAt,
    updatedAt
  };
}

export class HttpBusinessGateway implements BusinessPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpBusinessGateway {
    return new HttpBusinessGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async createBusiness(draft: BusinessDraft): Promise<BusinessResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post("/businesses", draft, { headers, validateStatus: () => true });
      if (response.status === 201) {
        const business = parseBusiness(response.data);
        return business ? { ok: true, business } : { ok: false, code: "unavailable" };
      }
      return { ok: false, code: codeForStatus(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async getMyBusiness(): Promise<BusinessResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/businesses/mine", { headers, validateStatus: () => true });
      if (response.status === 200) {
        const business = parseBusiness(response.data);
        return business ? { ok: true, business } : { ok: false, code: "unavailable" };
      }
      return { ok: false, code: codeForStatus(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}
