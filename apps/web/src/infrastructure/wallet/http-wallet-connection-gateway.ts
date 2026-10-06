import axios, { type AxiosInstance } from "axios";
import {
  WALLET_CONNECTION_ERROR_CODES,
  type WalletChallenge,
  type WalletChallengeResult,
  type WalletConnection,
  type WalletConnectionErrorCode,
  type WalletConnectionInput,
  type WalletConnectionPort,
  type WalletConnectionResult,
  type WalletStateResult
} from "@/application/ports/wallet-connection-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the persisted PyME wallet (Feature #406, Task #407 / T1c).
 *
 * It talks to `POST /profile/wallet/challenge`, `POST /profile/wallet` and
 * `GET /profile/wallet` with the signed-in session's `Authorization: Bearer`
 * token. The owner is resolved by the API from that token, so this adapter
 * never sends one.
 *
 * Failures are the sanitized `{ code }` the API sends, a status-derived code,
 * or `network` when the transport itself fails — provider messages and response
 * bodies never cross this boundary. A dedicated axios client is used (like the
 * business and upload adapters) so a malformed success body collapses to
 * `unavailable`.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

function isWalletConnectionErrorCode(value: unknown): value is WalletConnectionErrorCode {
  return typeof value === "string" && (WALLET_CONNECTION_ERROR_CODES as readonly string[]).includes(value);
}

/** The identifier-shaped `code` of the API's `{ code }` envelope, or `undefined`. */
function codeFromEnvelope(data: unknown): WalletConnectionErrorCode | undefined {
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  const code = (data as { code: unknown }).code;
  return isWalletConnectionErrorCode(code) ? code : undefined;
}

function codeForStatus(status: number, data: unknown): WalletConnectionErrorCode {
  const envelope = codeFromEnvelope(data);
  if (envelope) return envelope;
  if (status === 400) return "invalid_request";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "wallet_frozen";
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

/** Narrows the 201 body to a challenge; anything malformed is `undefined`. */
function parseChallenge(data: unknown): WalletChallenge | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { challengeId, message } = data as Record<string, unknown>;
  if (typeof challengeId !== "string" || challengeId.length === 0) return undefined;
  if (typeof message !== "string" || message.length === 0) return undefined;
  return { challengeId, message };
}

/** Narrows the 200 connection body to `{ publicKey, frozen }`. */
function parseConnection(data: unknown): WalletConnection | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { publicKey, frozen } = data as Record<string, unknown>;
  if (typeof publicKey !== "string" || publicKey.length === 0) return undefined;
  if (typeof frozen !== "boolean") return undefined;
  return { publicKey, frozen };
}

/** Narrows the 200 state body to `{ publicKey: string | null, frozen }`. */
function parseState(data: unknown): { publicKey: string | null; frozen: boolean } | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { publicKey, frozen } = data as Record<string, unknown>;
  if (publicKey !== null && (typeof publicKey !== "string" || publicKey.length === 0)) return undefined;
  if (typeof frozen !== "boolean") return undefined;
  return { publicKey, frozen };
}

export class HttpWalletConnectionGateway implements WalletConnectionPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpWalletConnectionGateway {
    return new HttpWalletConnectionGateway(
      axios.create({ baseURL: baseUrl, validateStatus: () => true }),
      accessToken
    );
  }

  async requestChallenge(): Promise<WalletChallengeResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post("/profile/wallet/challenge", undefined, {
        headers,
        validateStatus: () => true
      });
      if (response.status === 201) {
        const challenge = parseChallenge(response.data);
        return challenge ? { ok: true, challenge } : { ok: false, code: "unavailable" };
      }
      return { ok: false, code: codeForStatus(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async submitConnection(input: WalletConnectionInput): Promise<WalletConnectionResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post("/profile/wallet", input, {
        headers,
        validateStatus: () => true
      });
      if (response.status === 200) {
        const connection = parseConnection(response.data);
        return connection ? { ok: true, connection } : { ok: false, code: "unavailable" };
      }
      return { ok: false, code: codeForStatus(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  async getConnection(): Promise<WalletStateResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.get("/profile/wallet", { headers, validateStatus: () => true });
      if (response.status === 200) {
        const state = parseState(response.data);
        return state ? { ok: true, publicKey: state.publicKey, frozen: state.frozen } : { ok: false, code: "unavailable" };
      }
      return { ok: false, code: codeForStatus(response.status, response.data) };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}
