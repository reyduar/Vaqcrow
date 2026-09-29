import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import { HttpManualReviewGateway } from "./http-manual-review-gateway";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const CONTEXT = {
  applicationId: APPLICATION_ID,
  applicationState: "human_review",
  failureCode: "timeout",
  evidence: {
    periods: [
      {
        period: "2026-01",
        amountArs: 1_200_000,
        status: "reported",
        evidenceRef: "sales:2026-01",
        simuladoLabel: "SIMULADO"
      }
    ],
    findings: []
  },
  providerProvenance: {
    model: "simulated-underwriter",
    promptVersion: "prompt-v1",
    generatedAt: "2026-09-28T12:05:00.000Z",
    source: "simulated"
  },
  recordedAt: "2026-09-28T12:05:00.000Z"
};

function http(body: unknown, status = 200): { port: HttpClientPort; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn().mockResolvedValue({ status, body });
  return { port: { send } as unknown as HttpClientPort, send };
}

function failingPort(error: unknown): HttpClientPort {
  return { send: vi.fn().mockRejectedValue(error) } as unknown as HttpClientPort;
}

describe("HttpManualReviewGateway", () => {
  it("reads the application-scoped manual-review context from the exact path", async () => {
    const { port, send } = http(CONTEXT);

    const context = await new HttpManualReviewGateway(port).load(APPLICATION_ID);

    expect(context).toEqual(CONTEXT);
    // The simulated source is carried through so the screen can label it.
    expect(context?.providerProvenance?.source).toBe("simulated");
    expect(send).toHaveBeenCalledWith({
      method: "GET",
      path: `/application-reviews/${APPLICATION_ID}/manual-review`
    });
  });

  it("returns null for a truthful 404 (no handoff for the application)", async () => {
    const port = failingPort(new HttpClientError("http", 404, undefined, "not_found"));

    await expect(new HttpManualReviewGateway(port).load(APPLICATION_ID)).resolves.toBeNull();
  });

  it.each([
    ["503 unavailable", new HttpClientError("http", 503, undefined, "unavailable")],
    ["a network failure", new HttpClientError("network")]
  ])("propagates %s instead of pretending there is no context", async (_name, error) => {
    await expect(new HttpManualReviewGateway(failingPort(error)).load(APPLICATION_ID)).rejects.toBe(error);
  });

  it.each([
    ["a drifted envelope", { applicationId: APPLICATION_ID, extra: true }],
    ["an unknown failure code", { ...CONTEXT, failureCode: "provider 500" }],
    ["a raw diagnostic smuggled in", { ...CONTEXT, rawOutput: { recommendation: "approve" } }]
  ])("throws on %s rather than rendering a widened record", async (_name, body) => {
    const { port } = http(body);

    await expect(new HttpManualReviewGateway(port).load(APPLICATION_ID)).rejects.toThrow();
  });
});
