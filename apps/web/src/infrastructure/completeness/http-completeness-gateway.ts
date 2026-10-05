import axios, { type AxiosInstance } from "axios";
import {
  COMPLETENESS_ERROR_CODES,
  type CompletenessCheckInput,
  type CompletenessCheckPort,
  type CompletenessCheckResult,
  type CompletenessErrorCode,
  type CompletenessFinding,
  type CompletenessResult
} from "@/application/ports/completeness-check-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the application completeness check (Feature #402, Task #403
 * / T1c).
 *
 * It talks to `POST /completeness-check` with the signed-in session's
 * `Authorization: Bearer` token. The body is exactly the input's three fields;
 * the owner is resolved by the API from the token, so this adapter never sends
 * one. A `200 { result }` is unwrapped and validated against the finding
 * vocabulary: an unknown code, an unknown severity or an empty `detail`
 * collapses the WHOLE result to `unavailable`, rather than dropping just that
 * finding and rendering a partially-trusted list.
 *
 * Failures are the sanitized `{ code }` the API sends, a status-derived code,
 * or `network` when the transport itself fails — provider messages and response
 * bodies never cross this boundary. A dedicated axios client is used (like the
 * business and upload adapters) so a malformed success body collapses cleanly.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

const FINDING_CODES: readonly CompletenessFinding["code"][] = Object.freeze([
  "missing_document",
  "insufficient_photos",
  "missing_sales_month",
  "sales_anomaly",
  "content_irrelevant",
  "content_unverified"
]);

const FINDING_SEVERITIES: readonly CompletenessFinding["severity"][] = Object.freeze(["gap", "warning"]);

function isCompletenessErrorCode(value: unknown): value is CompletenessErrorCode {
  return typeof value === "string" && (COMPLETENESS_ERROR_CODES as readonly string[]).includes(value);
}

/** The identifier-shaped `code` of the API's `{ code }` envelope, or `undefined`. */
function codeFromEnvelope(data: unknown): CompletenessErrorCode | undefined {
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  const code = (data as { code: unknown }).code;
  return isCompletenessErrorCode(code) ? code : undefined;
}

function codeForStatus(status: number, data: unknown): CompletenessErrorCode {
  const envelope = codeFromEnvelope(data);
  if (envelope) return envelope;
  if (status === 400) return "invalid_request";
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

/**
 * Narrows `{ result }` to a result. Fail-closed: a finding outside the
 * vocabulary is not dropped from an otherwise-trusted result — the whole
 * result is `undefined`, and the caller answers `unavailable` instead of
 * rendering unverified data.
 */
function parseResult(data: unknown): CompletenessResult | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const candidate = (data as { result?: unknown }).result;
  if (typeof candidate !== "object" || candidate === null) return undefined;

  const { complete, findings } = candidate as { complete?: unknown; findings?: unknown };
  if (typeof complete !== "boolean" || !Array.isArray(findings)) return undefined;

  const parsed: CompletenessFinding[] = [];
  for (const entry of findings as unknown[]) {
    if (typeof entry !== "object" || entry === null) return undefined;
    const { code, severity, detail } = entry as { code?: unknown; severity?: unknown; detail?: unknown };
    if (typeof code !== "string" || !(FINDING_CODES as readonly string[]).includes(code)) return undefined;
    if (typeof severity !== "string" || !(FINDING_SEVERITIES as readonly string[]).includes(severity)) {
      return undefined;
    }
    if (typeof detail !== "string" || detail.length === 0) return undefined;
    parsed.push({
      code: code as CompletenessFinding["code"],
      severity: severity as CompletenessFinding["severity"],
      detail
    });
  }

  return { complete, findings: parsed };
}

export class HttpCompletenessGateway implements CompletenessCheckPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpCompletenessGateway {
    return new HttpCompletenessGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async check(input: CompletenessCheckInput): Promise<CompletenessCheckResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post("/completeness-check", input, { headers, validateStatus: () => true });
      if (response.status === 200) {
        const result = parseResult(response.data);
        return result ? { ok: true, result } : { ok: false, code: "unavailable" };
      }
      return { ok: false, code: codeForStatus(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}
