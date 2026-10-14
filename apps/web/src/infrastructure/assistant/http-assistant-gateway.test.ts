import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpAssistantGateway } from "./http-assistant-gateway";

/**
 * The assistant HTTP adapter (#499, WU3): one authenticated POST. The question
 * travels in the body, the parsed 200 body is the answer, a `403` is the
 * per-user flag off, a malformed success collapses to `unavailable`, a transport
 * failure is `network`, and the raw envelope never crosses the boundary.
 */

interface Call {
  readonly url: string;
  readonly body: unknown;
  readonly headers: Record<string, string> | undefined;
}

function fakeClient(wire: { status: number; data: unknown } | Error) {
  const calls: Call[] = [];
  const client = {
    post: async (
      url: string,
      body: unknown,
      config: { headers?: Record<string, string> } = {}
    ) => {
      calls.push({ url, body, headers: config.headers });
      if (wire instanceof Error) throw wire;
      return wire;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

const ANSWER = {
  answer: "El revenue share es un porcentaje de tus ventas.",
  citations: [{ id: "que-es-vaqcrow", title: "Qué es Vaqcrow", screen: "/about" }]
};

describe("HttpAssistantGateway", () => {
  it("POSTs the question with the bearer token and parses the answer", async () => {
    const { client, calls } = fakeClient({ status: 200, data: ANSWER });
    const gateway = new HttpAssistantGateway(client, async () => "token-123");

    const result = await gateway.ask("¿Qué es el revenue share?");

    expect(result).toEqual({ ok: true, answer: ANSWER });
    expect(calls).toEqual([
      {
        url: "/assistant/questions",
        body: { question: "¿Qué es el revenue share?" },
        headers: { Authorization: "Bearer token-123" }
      }
    ]);
  });

  it("sends no Authorization header without a readable token", async () => {
    const { client, calls } = fakeClient({ status: 200, data: ANSWER });
    const gateway = new HttpAssistantGateway(client, async () => {
      throw new Error("no session");
    });

    await gateway.ask("pregunta");

    expect(calls[0]?.headers).toBeUndefined();
  });

  it("never puts the token in a header when it is not an RFC 6750 b64token", async () => {
    const { client, calls } = fakeClient({ status: 200, data: ANSWER });
    const gateway = new HttpAssistantGateway(client, async () => "bad token\n");

    await gateway.ask("pregunta");

    expect(calls[0]?.headers).toBeUndefined();
  });

  it("maps 403 to the flag-off code, not a service failure", async () => {
    const { client } = fakeClient({ status: 403, data: { code: "forbidden" } });
    const gateway = new HttpAssistantGateway(client, async () => "token");

    expect(await gateway.ask("pregunta")).toEqual({ ok: false, code: "forbidden" });
  });

  it.each([500, 503])("maps %i to unavailable", async (status) => {
    const { client } = fakeClient({ status, data: { code: "unavailable", message: "secret" } });
    const gateway = new HttpAssistantGateway(client, async () => "token");

    const result = await gateway.ask("pregunta");
    expect(result).toEqual({ ok: false, code: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("collapses a malformed 200 body to unavailable instead of rendering it", async () => {
    const { client } = fakeClient({ status: 200, data: { answer: "", citations: [] } });
    const gateway = new HttpAssistantGateway(client, async () => "token");

    expect(await gateway.ask("pregunta")).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps a transport failure to network", async () => {
    const { client } = fakeClient(new Error("socket hang up"));
    const gateway = new HttpAssistantGateway(client, async () => "token");

    expect(await gateway.ask("pregunta")).toEqual({ ok: false, code: "network" });
  });

  it("builds a dedicated axios client with the base URL", () => {
    const gateway = HttpAssistantGateway.create("https://api.example.test");
    expect(gateway).toBeInstanceOf(HttpAssistantGateway);
  });
});
