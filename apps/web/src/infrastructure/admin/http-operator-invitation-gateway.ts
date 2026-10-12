import axios, { type AxiosInstance } from "axios";
import type { AcceptOperatorInvitationCommand } from "@vaqcrow/contracts";
import type {
  OperatorInvitationErrorCode,
  OperatorInvitationPort,
  OperatorInvitationResult
} from "@/application/ports/operator-invitation-port";
import type { AccessTokenProvider } from "@/infrastructure/http/axios-http-client";

/**
 * HTTP adapter for the invitation acceptance (#390/WU5), talking to the
 * AUTHENTICATED route `POST /admin/invitations/accept` with the invited
 * operator's own Bearer token.
 *
 * The success body echoes `{ userId, displayName }`; the display name must match
 * the one sent, or the response collapses to the sanitized `unavailable`. The
 * envelope's raw `message`/`details` never cross this boundary.
 */

/** RFC 6750 `b64token` characters: anything else (spaces, CR/LF) is never put in a header. */
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9\-._~+/]+=*$/;

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

/** Guards the acceptance response: the echoed display name must match the request. */
function matchesDisplayName(data: unknown, displayName: string): boolean {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return record["displayName"] === displayName;
}

function failureCode(status: number): OperatorInvitationErrorCode {
  if (status === 401) return "unauthenticated";
  if (status === 400) return "invalid_request";
  if (status === 404) return "not_found";
  return "unavailable";
}

export class HttpOperatorInvitationGateway implements OperatorInvitationPort {
  constructor(
    private readonly client: AxiosInstance,
    private readonly accessToken?: AccessTokenProvider
  ) {}

  /** Builds the gateway around a dedicated axios instance with `baseURL` set. */
  static create(baseUrl: string, accessToken?: AccessTokenProvider): HttpOperatorInvitationGateway {
    return new HttpOperatorInvitationGateway(axios.create({ baseURL: baseUrl, validateStatus: () => true }), accessToken);
  }

  async accept(command: AcceptOperatorInvitationCommand): Promise<OperatorInvitationResult> {
    const headers = await headersFor(this.accessToken);
    try {
      const response = await this.client.post(
        "/admin/invitations/accept",
        { displayName: command.displayName },
        { ...(headers ? { headers } : {}), validateStatus: () => true }
      );
      if (response.status === 200) {
        return matchesDisplayName(response.data, command.displayName) ? { ok: true } : { ok: false, code: "unavailable" };
      }
      return { ok: false, code: failureCode(response.status) };
    } catch {
      return { ok: false, code: "network" };
    }
  }
}
