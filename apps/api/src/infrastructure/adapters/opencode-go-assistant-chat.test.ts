import { describe, expect, it, vi } from "vitest";
import type { AssistantChatMessage } from "../../application/ports/assistant-chat-port.js";
import { createOpenCodeGoAssistantChat } from "./opencode-go-assistant-chat.js";

/**
 * The OpenCode Go assistant transport (#499/WU2). It speaks the same
 * OpenAI-compatible dialect as `@vaqcrow/ai` — bearer auth, the mandatory
 * `x-opencode-session` header and the client user agent — and it treats a null
 * `content` or a `finish_reason: "length"` as a defined failure, never as an
 * empty answer. No live provider: the transport is injected.
 */
const MESSAGES: readonly AssistantChatMessage[] = [
  { role: "system", content: "sos un router" },
  { role: "user", content: "pregunta" }
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function adapter(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return createOpenCodeGoAssistantChat({
    baseUrl: "https://provider.example.test/v1",
    model: "deepseek-v4-flash",
    apiKey: "key-sentinel",
    timeoutMs: 1_000,
    sessionId: "session-1",
    fetchImpl,
    ...overrides
  });
}

describe("createOpenCodeGoAssistantChat", () => {
  it("sends the dialect and returns the message content", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ choices: [{ message: { content: "hola" }, finish_reason: "stop" }] })
    ) as unknown as typeof fetch;

    const result = await adapter(fetchImpl).complete(MESSAGES);

    expect(result).toEqual({ ok: true, value: "hola" });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://provider.example.test/v1/chat/completions");
    expect(init.headers).toMatchObject({
      authorization: "Bearer key-sentinel",
      "x-opencode-session": "session-1",
      "user-agent": "vaqcrow-assistant/1.0"
    });
    const body = JSON.parse(String(init.body)) as { model: string; temperature: number; max_tokens: number; messages: unknown };
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(2000);
    expect(body.messages).toEqual(MESSAGES);
    expect(body).not.toHaveProperty("response_format");
  });

  it("accepts a configured max_tokens and session id", async () => {
    const fetchImpl = vi.fn(async () => json({ choices: [{ message: { content: "x" } }] })) as unknown as typeof fetch;
    await adapter(fetchImpl, { maxTokens: 512, sessionId: "custom" }).complete(MESSAGES);
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    expect((JSON.parse(String(init.body)) as { max_tokens: number }).max_tokens).toBe(512);
    expect(init.headers).toMatchObject({ "x-opencode-session": "custom" });
  });

  it.each([
    ["a null content", { choices: [{ message: { content: null }, finish_reason: "stop" }] }],
    ["a missing content", { choices: [{ message: {}, finish_reason: "stop" }] }],
    ["an empty content", { choices: [{ message: { content: "  " } }] }],
    ["a length-limited finish", { choices: [{ message: { content: "partial" }, finish_reason: "length" }] }],
    ["no choices", { choices: [] }]
  ])("answers invalid_output for %s, never an empty answer", async (_label, payload) => {
    const fetchImpl = vi.fn(async () => json(payload)) as unknown as typeof fetch;
    expect(await adapter(fetchImpl).complete(MESSAGES)).toEqual({
      ok: false,
      error: { code: "invalid_output" }
    });
  });

  it("answers unavailable on a non-2xx, invalid JSON or a network error", async () => {
    const bad = vi.fn(async () => json({}, 500)) as unknown as typeof fetch;
    expect(await adapter(bad).complete(MESSAGES)).toEqual({ ok: false, error: { code: "unavailable" } });

    const notJson = vi.fn(async () => new Response("nope", { status: 200 })) as unknown as typeof fetch;
    expect(await adapter(notJson).complete(MESSAGES)).toEqual({ ok: false, error: { code: "unavailable" } });

    const thrown = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await adapter(thrown).complete(MESSAGES)).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("maps a transport abort to timeout", async () => {
    const fetchImpl = vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "TimeoutError";
      throw error;
    }) as unknown as typeof fetch;
    expect(await adapter(fetchImpl).complete(MESSAGES)).toEqual({ ok: false, error: { code: "timeout" } });
  });
});
