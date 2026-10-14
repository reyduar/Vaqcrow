import axios, { type AxiosInstance } from "axios";
import { parseAssistantAnswer } from "@vaqcrow/contracts";
import type { AssistantAskResult, AssistantPort } from "@/application/assistant/assistant-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the help assistant (#499, WU3) talking to
 * `POST /assistant/questions`, with the signed-in session's
 * `Authorization: Bearer` token.
 *
 * The question is untrusted input: it travels as the body's only field and is
 * never concatenated into the URL. The 200 body is parsed through the contract
 * parser, so a malformed success collapses to `unavailable` instead of
 * rendering. A `403` is the per-user flag off (D9) → `forbidden`; every other
 * non-200 status is the sanitized `unavailable`; a transport failure is
 * `network`. The envelope's raw message/details never cross this boundary.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

async function headersFor(
  provider: AccessTokenProvider | undefined
): Promise<Record<string, string> | undefined> {
  if (!provider) return undefined;
  let token: string | null;
  try {
    token = await provider();
  } catch {
    return undefined;
  }
  return typeof token === "string" && BEARER_TOKEN_PATTERN.test(token)
    ? { Authorization: `Bearer ${token}` }
    : undefined;
}

export class HttpAssistantGateway implements AssistantPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpAssistantGateway {
    return new HttpAssistantGateway(
      axios.create({ baseURL: baseUrl, validateStatus: () => true }),
      accessToken
    );
  }

  async ask(question: string): Promise<AssistantAskResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post(
        "/assistant/questions",
        { question },
        { ...(headers ? { headers } : {}), validateStatus: () => true }
      );
      if (response.status === 403) return { ok: false, code: "forbidden" };
      if (response.status !== 200) return { ok: false, code: "unavailable" };
      try {
        return { ok: true, answer: parseAssistantAnswer(response.data) };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    } catch {
      return { ok: false, code: "network" };
    }
  }
}
