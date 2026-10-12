import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpOperatorInvitationGateway } from "./http-operator-invitation-gateway";

/**
 * The invitation-acceptance HTTP gateway (#390/WU5): it POSTs `{ displayName }`
 * to `/admin/invitations/accept` with the session's Bearer token. Every status
 * becomes a sanitized code; a status the boundary does not understand — or a
 * body that does not echo the sent name — is `unavailable`, never a fake
 * success.
 */

interface Call {
  readonly url: string;
  readonly body: unknown;
  readonly headers: Record<string, string> | undefined;
}

function fakeClient(wire: { status: number; data: unknown } | Error) {
  const calls: Call[] = [];
  const client = {
    post: async (url: string, body: unknown, config: { headers?: Record<string, string> } = {}) => {
      calls.push({ url, body, headers: config.headers });
      if (wire instanceof Error) throw wire;
      return wire;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

const COMMAND = { displayName: "Ana Operadora" };

describe("HttpOperatorInvitationGateway.accept", () => {
  it("posts the display name with the Bearer token and reports success on the echoed name", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { userId: "u-1", displayName: "Ana Operadora" } });
    const gateway = new HttpOperatorInvitationGateway(client, async () => "token-123");

    const result = await gateway.accept(COMMAND);

    expect(result).toEqual({ ok: true });
    expect(calls[0]!.url).toBe("/admin/invitations/accept");
    expect(calls[0]!.body).toEqual({ displayName: "Ana Operadora" });
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("rejects a 200 whose body does not echo the sent name", async () => {
    const gateway = new HttpOperatorInvitationGateway(
      fakeClient({ status: 200, data: { userId: "u-1", displayName: "Otra Persona" } }).client
    );

    expect(await gateway.accept(COMMAND)).toEqual({ ok: false, code: "unavailable" });
  });

  it.each([
    [401, "unauthenticated"],
    [400, "invalid_request"],
    [404, "not_found"],
    [500, "unavailable"],
    [503, "unavailable"]
  ] as const)("maps status %i to %s", async (status, code) => {
    const gateway = new HttpOperatorInvitationGateway(fakeClient({ status, data: { code: "whatever" } }).client);

    expect(await gateway.accept(COMMAND)).toEqual({ ok: false, code });
  });

  it("maps a transport failure to network", async () => {
    const gateway = new HttpOperatorInvitationGateway(fakeClient(new Error("boom")).client);

    expect(await gateway.accept(COMMAND)).toEqual({ ok: false, code: "network" });
  });
});
