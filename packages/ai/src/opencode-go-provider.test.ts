import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_PROMPT_VERSION,
  createOpenCodeGoProvider,
  runAssessment
} from "./index.js";
import type { AssessmentEvidenceBundle } from "./index.js";

/**
 * Behaviour of the real provider adapter (Task #226).
 *
 * The transport is injected, so every case here is deterministic and offline:
 * pull-request checks must never reach a live provider. The live path is
 * verified separately, credential-gated.
 *
 * The adapter's job is narrow — speak the provider's HTTP dialect, send what the
 * provider demands, and hand back the raw answer plus provenance. It does not
 * validate the assessment and it does not invent error codes: the four codes it
 * may return are the ones the port already declares.
 */

const PERIOD = {
  period: "2026-01",
  amountArs: 1_200_000,
  status: "reported",
  evidenceRef: "sales:2026-01",
  simuladoLabel: "SIMULADO"
} as const;

const EVIDENCE: AssessmentEvidenceBundle = { periods: [PERIOD], findings: [] };

const VALID_OUTPUT = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [],
  missingData: [],
  recommendedAction: "human_review",
  questions: []
};

const FIXED_NOW = "2026-09-22T12:00:00.000Z";

type CapturedRequest = {
  readonly url: string;
  readonly init: RequestInit;
};

function providerAnswering(content: unknown, status = 200): {
  provider: ReturnType<typeof createOpenCodeGoProvider>;
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

  const provider = createOpenCodeGoProvider({
    baseUrl: "https://provider.test/v1",
    model: "glm-5.3-flash",
    apiKey: "key-sentinel",
    timeoutMs: 15_000,
    sessionId: "session-sentinel",
    now: () => FIXED_NOW,
    fetchImpl
  });

  return { provider, captured };
}

describe("createOpenCodeGoProvider", () => {
  it("returns the provider's answer as untrusted raw output with its provenance", async () => {
    const { provider } = providerAnswering(JSON.stringify(VALID_OUTPUT));

    const outcome = await provider.assess({ evidence: EVIDENCE });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }

    // The model answers with text, and the adapter hands that text back
    // untouched: parsing it is the caller's normalization, and validating it is
    // the contract's job. An adapter that "helpfully" parsed would be an adapter
    // that decided what a valid answer looks like.
    expect(outcome.rawOutput).toBe(JSON.stringify(VALID_OUTPUT));
    expect(outcome.metadata).toEqual({
      model: "glm-5.3-flash",
      promptVersion: ASSESSMENT_PROMPT_VERSION,
      generatedAt: FIXED_NOW,
      source: "provider"
    });
  });

  it("rejects an answer wrapped in a markdown fence rather than stripping it", async () => {
    const fenced = ["```json", JSON.stringify(VALID_OUTPUT), "```"].join("\n");
    const { provider } = providerAnswering(fenced);

    const result = await runAssessment(provider, { evidence: EVIDENCE });

    expect(result).toEqual({ ok: false, error: { code: "invalid_output" } });
  });

  it("calls the provider's chat-completions endpoint with the mandatory headers", async () => {
    const { provider, captured } = providerAnswering(JSON.stringify(VALID_OUTPUT));

    await provider.assess({ evidence: EVIDENCE });

    expect(captured).toHaveLength(1);
    const request = captured[0];
    expect(request?.url).toBe("https://provider.test/v1/chat/completions");

    const headers = request?.init.headers as Record<string, string>;
    // Without the session header the provider answers 400 MissingSessionID.
    expect(headers["x-opencode-session"]).toBe("session-sentinel");
    expect(headers["user-agent"]).toBeTruthy();
    expect(headers["user-agent"]).not.toMatch(/undici|node-fetch|axios/i);
    expect(headers.authorization).toBe("Bearer key-sentinel");
  });

  it("sends the model and only the supplied evidence", async () => {
    const { provider, captured } = providerAnswering(JSON.stringify(VALID_OUTPUT));

    await provider.assess({ evidence: EVIDENCE });

    const body = JSON.parse(String(captured[0]?.init.body)) as {
      model: string;
      messages: readonly { role: string; content: string }[];
      temperature: number;
    };

    expect(body.model).toBe("glm-5.3-flash");
    expect(body.temperature).toBe(0);
    expect(body.messages[0]?.role).toBe("system");
    expect(body.messages[1]?.content).toContain("sales:2026-01");
    // The evidence travels whole, and nothing else does.
    expect(body.messages[1]?.content).toContain("2026-01");
  });

  it("sends the configured thinking budget and never the mutually exclusive switch", async () => {
    const captured: CapturedRequest[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      captured.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as unknown as typeof fetch;

    const provider = createOpenCodeGoProvider({
      baseUrl: "https://provider.test/v1",
      model: "glm-5.3-flash",
      apiKey: "key-sentinel",
      timeoutMs: 15_000,
      reasoningEffort: "none",
      fetchImpl
    });

    await provider.assess({ evidence: EVIDENCE });

    const body = JSON.parse(String(captured[0]?.init.body)) as Record<string, unknown>;
    expect(body["reasoning_effort"]).toBe("none");
    // The endpoint rejects a request carrying both switches with a 400, so
    // `thinking` must never appear.
    expect(body).not.toHaveProperty("thinking");
  });

  it("omits the thinking budget when it is not configured", async () => {
    const { provider, captured } = providerAnswering(JSON.stringify(VALID_OUTPUT));

    await provider.assess({ evidence: EVIDENCE });

    const body = JSON.parse(String(captured[0]?.init.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(body).not.toHaveProperty("thinking");
  });

  it("never reveals the key in the returned outcome", async () => {    const { provider } = providerAnswering(JSON.stringify(VALID_OUTPUT));

    const outcome = await provider.assess({ evidence: EVIDENCE });

    expect(JSON.stringify(outcome)).not.toContain("key-sentinel");
  });

  it("maps a non-2xx response to provider_unavailable", async () => {
    const { provider } = providerAnswering({ error: "boom" }, 500);

    const outcome = await provider.assess({ evidence: EVIDENCE });

    expect(outcome).toEqual({ ok: false, error: { code: "provider_unavailable" } });
  });

  it("maps a 401 to provider_unavailable without leaking the provider's message", async () => {
    const { provider } = providerAnswering({ error: "Invalid API key." }, 401);

    const outcome = await provider.assess({ evidence: EVIDENCE });

    expect(outcome).toEqual({ ok: false, error: { code: "provider_unavailable" } });
    expect(JSON.stringify(outcome)).not.toContain("Invalid API key");
  });

  it("maps an aborted request to a timeout", async () => {
    const aborting = (async () => {
      const error = new Error("aborted");
      error.name = "TimeoutError";
      throw error;
    }) as unknown as typeof fetch;

    const provider = createOpenCodeGoProvider({
      baseUrl: "https://provider.test/v1",
      model: "glm-5.3-flash",
      apiKey: "key-sentinel",
      timeoutMs: 15_000,
      fetchImpl: aborting
    });

    const outcome = await provider.assess({ evidence: EVIDENCE });

    expect(outcome).toEqual({ ok: false, error: { code: "timeout" } });
  });

  it("maps a transport failure that is not an abort to provider_unavailable", async () => {
    const failing = (async () => {
      throw new Error("getaddrinfo ENOTFOUND provider.test");
    }) as unknown as typeof fetch;

    const provider = createOpenCodeGoProvider({
      baseUrl: "https://provider.test/v1",
      model: "glm-5.3-flash",
      apiKey: "key-sentinel",
      timeoutMs: 15_000,
      fetchImpl: failing
    });

    const outcome = await provider.assess({ evidence: EVIDENCE });

    expect(outcome).toEqual({ ok: false, error: { code: "provider_unavailable" } });
  });

  it("maps a body that is not JSON to provider_unavailable", async () => {
    const notJson = (async () =>
      new Response("<html>gateway</html>", {
        status: 200,
        headers: { "content-type": "text/html" }
      })) as unknown as typeof fetch;

    const provider = createOpenCodeGoProvider({
      baseUrl: "https://provider.test/v1",
      model: "glm-5.3-flash",
      apiKey: "key-sentinel",
      timeoutMs: 15_000,
      fetchImpl: notJson
    });

    const outcome = await provider.assess({ evidence: EVIDENCE });

    expect(outcome).toEqual({ ok: false, error: { code: "provider_unavailable" } });
  });

  it("treats an empty message content as an invalid assessment, not an answer", async () => {
    // Reasoning models return their thinking in `reasoning_content` and can
    // leave `content` empty when the token budget runs out. That is not an
    // assessment, and the contract must reject it rather than pass it on.
    const { provider } = providerAnswering("");

    const result = await runAssessment(provider, { evidence: EVIDENCE });

    expect(result).toEqual({ ok: false, error: { code: "invalid_output" } });
  });

  it("treats a message with no content field at all as an invalid assessment", async () => {
    const shapeOnly = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { reasoning_content: "thinking" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })) as unknown as typeof fetch;

    const provider = createOpenCodeGoProvider({
      baseUrl: "https://provider.test/v1",
      model: "glm-5.3-flash",
      apiKey: "key-sentinel",
      timeoutMs: 15_000,
      fetchImpl: shapeOnly
    });

    const result = await runAssessment(provider, { evidence: EVIDENCE });

    expect(result).toEqual({ ok: false, error: { code: "invalid_output" } });
  });

  it("end to end: a well-formed provider answer becomes a validated assessment", async () => {
    const { provider } = providerAnswering(JSON.stringify(VALID_OUTPUT));

    const result = await runAssessment(provider, { evidence: EVIDENCE });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.assessment.riskBand).toBe("medium");
    expect(result.value.metadata.source).toBe("provider");
  });
});
