import { describe, expect, it } from "vitest";
import {
  VISION_PROMPT_VERSION,
  buildVisionQuestion,
  createOpenCodeGoVisionProvider
} from "./index.js";

/**
 * Behaviour of the real vision adapter (Feature #402, U3).
 *
 * The transport is injected, so every case here is deterministic and offline:
 * the pull-request suite never reaches a live model. The adapter's job is
 * narrow — speak the provider's OpenAI-compatible multimodal dialect, send the
 * image as a data URL, and hand back a **validated** relevance verdict or a
 * sanitized failure code. Vendor text never crosses back.
 */

const FIXED_NOW = "2026-10-05T12:00:00.000Z";
const INPUT = { kind: "cuit", contentType: "image/png", imageBase64: "QUJD" } as const;

const RELEVANT = JSON.stringify({
  relevant: false,
  reason: "No parece una Constancia de CUIT."
});

type CapturedRequest = {
  readonly url: string;
  readonly init: RequestInit;
};

function providerAnswering(content: unknown, status = 200): {
  provider: ReturnType<typeof createOpenCodeGoVisionProvider>;
  captured: CapturedRequest[];
} {
  const captured: CapturedRequest[] = [];

  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    return new Response(
      JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }),
      { status, headers: { "content-type": "application/json" } }
    );
  }) as unknown as typeof fetch;

  const provider = createOpenCodeGoVisionProvider({
    baseUrl: "https://provider.test/v1",
    model: "deepseek-v4-flash-vision-exp",
    apiKey: "vision-key-sentinel",
    timeoutMs: 15_000,
    sessionId: "vision-session-sentinel",
    now: () => FIXED_NOW,
    fetchImpl
  });

  return { provider, captured };
}

function providerFromFetch(fetchImpl: typeof fetch): ReturnType<typeof createOpenCodeGoVisionProvider> {
  return createOpenCodeGoVisionProvider({
    baseUrl: "https://provider.test/v1",
    model: "deepseek-v4-flash-vision-exp",
    apiKey: "vision-key-sentinel",
    timeoutMs: 15_000,
    fetchImpl
  });
}

describe("createOpenCodeGoVisionProvider — success", () => {
  it("returns the validated verdict with its provenance", async () => {
    const { provider } = providerAnswering(RELEVANT);

    const outcome = await provider.assessRelevance(INPUT);

    expect(outcome).toEqual({
      ok: true,
      value: { relevant: false, reason: "No parece una Constancia de CUIT." },
      metadata: {
        model: "deepseek-v4-flash-vision-exp",
        promptVersion: VISION_PROMPT_VERSION,
        generatedAt: FIXED_NOW,
        source: "provider"
      }
    });
  });

  it("calls chat-completions with the vision model, the session header and the auth", async () => {
    const { provider, captured } = providerAnswering(RELEVANT);

    await provider.assessRelevance(INPUT);

    expect(captured).toHaveLength(1);
    const request = captured[0];
    expect(request?.url).toBe("https://provider.test/v1/chat/completions");

    const headers = request?.init.headers as Record<string, string>;
    expect(headers["x-opencode-session"]).toBe("vision-session-sentinel");
    expect(headers.authorization).toBe("Bearer vision-key-sentinel");
    expect(headers["user-agent"]).toBeTruthy();
    expect(headers["user-agent"]).not.toMatch(/undici|node-fetch|axios/i);
  });

  it("sends the image as a data URL inside an OpenAI-compatible content array", async () => {
    const { provider, captured } = providerAnswering(RELEVANT);

    await provider.assessRelevance({ kind: "cuit", contentType: "image/png", imageBase64: "QUJD" });

    const body = JSON.parse(String(captured[0]?.init.body)) as {
      model: string;
      temperature: number;
      messages: readonly { role: string; content: unknown }[];
    };

    expect(body.model).toBe("deepseek-v4-flash-vision-exp");
    expect(body.temperature).toBe(0);
    expect(body.messages[0]?.role).toBe("system");

    const user = body.messages[1];
    expect(user?.role).toBe("user");
    expect(user?.content).toEqual([
      { type: "text", text: buildVisionQuestion("cuit") },
      { type: "image_url", image_url: { url: "data:image/png;base64,QUJD" } }
    ]);
  });

  it("asks the per-kind question and never the mutually exclusive thinking switch", async () => {
    const { provider, captured } = providerAnswering(RELEVANT);

    await provider.assessRelevance({ kind: "photo", contentType: "image/jpeg", imageBase64: "QQ==" });

    const body = JSON.parse(String(captured[0]?.init.body)) as {
      messages: readonly { content: unknown }[];
    };
    const parts = body.messages[1]?.content as readonly { type: string; text?: string }[];

    expect(parts[0]?.text).toBe(buildVisionQuestion("photo"));
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body).not.toHaveProperty("thinking");
  });
});

describe("createOpenCodeGoVisionProvider — failures", () => {
  it("maps a non-2xx response to provider_unavailable", async () => {
    const { provider } = providerAnswering({ error: "boom" }, 500);

    expect(await provider.assessRelevance(INPUT)).toEqual({
      ok: false,
      error: { code: "provider_unavailable" }
    });
  });

  it("maps a 401 to provider_unavailable without leaking the provider's message or the key", async () => {
    const { provider } = providerAnswering({ error: "Invalid API key." }, 401);

    const outcome = await provider.assessRelevance(INPUT);

    expect(outcome).toEqual({ ok: false, error: { code: "provider_unavailable" } });
    expect(JSON.stringify(outcome)).not.toContain("Invalid API key");
    expect(JSON.stringify(outcome)).not.toContain("vision-key-sentinel");
  });

  it("maps an aborted request to a timeout", async () => {
    const aborting = (async () => {
      const error = new Error("aborted");
      error.name = "TimeoutError";
      throw error;
    }) as unknown as typeof fetch;

    expect(await providerFromFetch(aborting).assessRelevance(INPUT)).toEqual({
      ok: false,
      error: { code: "timeout" }
    });
  });

  it("maps any other transport failure to provider_unavailable", async () => {
    const failing = (async () => {
      throw new Error("getaddrinfo ENOTFOUND provider.test");
    }) as unknown as typeof fetch;

    expect(await providerFromFetch(failing).assessRelevance(INPUT)).toEqual({
      ok: false,
      error: { code: "provider_unavailable" }
    });
  });

  it("maps a body that is not JSON to provider_unavailable", async () => {
    const notJson = (async () =>
      new Response("<html>gateway</html>", {
        status: 200,
        headers: { "content-type": "text/html" }
      })) as unknown as typeof fetch;

    expect(await providerFromFetch(notJson).assessRelevance(INPUT)).toEqual({
      ok: false,
      error: { code: "provider_unavailable" }
    });
  });

  it.each([
    ["a non-JSON answer", "No es JSON"],
    ["an answer wrapped in a markdown fence", ["```json", RELEVANT, "```"].join("\n")],
    ["an empty answer", ""],
    ["a shape with the wrong types", JSON.stringify({ relevant: "yes", reason: "x" })],
    ["a shape with a missing reason", JSON.stringify({ relevant: false })],
    ["a shape with an unknown field", JSON.stringify({ relevant: false, reason: "x", extra: 1 })],
    ["an over-long reason", JSON.stringify({ relevant: true, reason: "a".repeat(301) })]
  ])("rejects %s as invalid_output", async (_label, content) => {
    const { provider } = providerAnswering(content);

    expect(await provider.assessRelevance(INPUT)).toEqual({
      ok: false,
      error: { code: "invalid_output" }
    });
  });

  it("treats a message with no content field at all as invalid_output", async () => {
    const shapeOnly = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { reasoning_content: "thinking" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })) as unknown as typeof fetch;

    expect(await providerFromFetch(shapeOnly).assessRelevance(INPUT)).toEqual({
      ok: false,
      error: { code: "invalid_output" }
    });
  });

  it("never reveals the key in the returned outcome", async () => {
    const { provider } = providerAnswering(RELEVANT);

    const outcome = await provider.assessRelevance(INPUT);

    expect(JSON.stringify(outcome)).not.toContain("vision-key-sentinel");
  });
});
