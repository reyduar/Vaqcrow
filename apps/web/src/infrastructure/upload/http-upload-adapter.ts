import axios, { type AxiosInstance } from "axios";
import {
  UPLOAD_ERROR_CODES,
  type RemoveDocumentResult,
  type UploadDocumentInput,
  type UploadDocumentResult,
  type UploadErrorCode,
  type UploadPort,
  type UploadedDocument
} from "@/application/ports/upload-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the API-mediated upload (Feature #398, Task #399 / T4c).
 *
 * The bytes never reach Supabase Storage from the browser: this adapter posts
 * multipart to `POST /storage/uploads` and deletes through
 * `DELETE /storage/uploads?path=`, always with the signed-in session's
 * `Authorization: Bearer` token. The API re-validates the bytes and owns the
 * `service_role` write. Failures are the sanitized `{ code }` the API sends,
 * a status-derived code, or `network` when the transport itself fails —
 * provider messages and response bodies never cross this boundary.
 *
 * A dedicated axios client is used instead of `AxiosHttpClient` because the
 * upload needs multipart bodies and `onUploadProgress`, which that port does
 * not expose.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

function isUploadErrorCode(value: unknown): value is UploadErrorCode {
  return typeof value === "string" && (UPLOAD_ERROR_CODES as readonly string[]).includes(value);
}

/** The identifier-shaped `code` of the API's `{ code }` envelope, or `undefined`. */
function codeFromEnvelope(data: unknown): UploadErrorCode | undefined {
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  const code = (data as { code: unknown }).code;
  return isUploadErrorCode(code) ? code : undefined;
}

function codeForStatus(status: number, data: unknown): UploadErrorCode {
  const envelope = codeFromEnvelope(data);
  if (envelope) return envelope;
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 413) return "too_large";
  if (status === 415) return "unsupported_type";
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

/** Narrows the 201 body to the descriptor; anything malformed is `unavailable`. */
function parseDescriptor(data: unknown): UploadedDocument | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { path, name, size, contentType } = data as Record<string, unknown>;
  if (typeof path !== "string" || path.length === 0) return undefined;
  if (typeof name !== "string" || typeof size !== "number" || typeof contentType !== "string") return undefined;
  return { path, name, size, contentType };
}

export class HttpUploadAdapter implements UploadPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the adapter around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpUploadAdapter {
    return new HttpUploadAdapter(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async uploadDocument({ kind, file, onProgress }: UploadDocumentInput): Promise<UploadDocumentResult> {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file, file.name);
    const headers = await headersFor(this.accessToken);

    try {
      const response = await this.client.post("/storage/uploads", form, {
        headers,
        validateStatus: () => true,
        onUploadProgress: (event) => {
          if (!onProgress) return;
          if (typeof event.total === "number" && event.total > 0) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        }
      });

      if (response.status === 201) {
        const descriptor = parseDescriptor(response.data);
        return descriptor ? { ok: true, ...descriptor } : { ok: false, code: "unavailable" };
      }
      return { ok: false, code: codeForStatus(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async removeDocument(path: string): Promise<RemoveDocumentResult> {
    const headers = await headersFor(this.accessToken);

    try {
      const response = await this.client.delete(`/storage/uploads?path=${encodeURIComponent(path)}`, {
        headers,
        validateStatus: () => true
      });

      if (response.status === 204) return { ok: true };
      return { ok: false, code: codeForStatus(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}
