import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import { HttpHumanDecisionGateway } from "./http-human-decision-gateway";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DECISION_ID = "11111111-1111-4111-8111-111111111111";
const command = {
  applicationId: APPLICATION_ID,
  decisionId: DECISION_ID,
  outcome: "approved",
  actor: "op",
  reason: "ok",
  approvedLimitArs: 100
} as never;
const record = {
  decisionId: DECISION_ID,
  applicationId: APPLICATION_ID,
  outcome: "approved",
  actor: "op",
  reason: "ok",
  approvedLimitArs: 100,
  decidedAt: "2026-09-19T12:00:00.000Z",
  correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
};

function http(body: unknown, status = 201) {
  const send = vi.fn().mockResolvedValue({ status, body });
  return { port: { send } as unknown as HttpClientPort, send };
}

/** The real `HttpClientPort` rejects on a non-2xx, so a failing read is modelled as a rejection. */
function httpRejects(error: unknown) {
  const send = vi.fn().mockRejectedValue(error);
  return { port: { send } as unknown as HttpClientPort, send };
}

describe("HttpHumanDecisionGateway", () => {
  it("posts exactly the five body keys (applicationId travels in the path)", async () => {
    const { port, send } = http({ applied: true, decision: record });
    await new HttpHumanDecisionGateway(port).record(command);

    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: `/application-reviews/${APPLICATION_ID}/decisions`,
      body: { decisionId: DECISION_ID, outcome: "approved", actor: "op", reason: "ok", approvedLimitArs: 100 }
    });
  });

  it("returns the contract-validated result, including an idempotent replay", async () => {
    const { port } = http({ applied: false, decision: record }, 200);
    await expect(new HttpHumanDecisionGateway(port).record(command)).resolves.toEqual({
      applied: false,
      decision: record
    });
  });

  it.each([
    ["missing decision", { applied: true }],
    ["extra keys", { applied: true, decision: record, extra: 1 }],
    ["non-boolean applied", { applied: "yes", decision: record }],
    ["broken record", { applied: true, decision: { ...record, decidedAt: "yesterday" } }]
  ])("throws on a malformed response: %s", async (_name, body) => {
    const { port } = http(body);
    await expect(new HttpHumanDecisionGateway(port).record(command)).rejects.toThrow();
  });
});

describe("HttpHumanDecisionGateway.readLatest", () => {
  it("reads the decision from the path and returns the contract-validated record", async () => {
    const { port, send } = http({ decision: record }, 200);
    await expect(new HttpHumanDecisionGateway(port).readLatest(APPLICATION_ID)).resolves.toEqual(record);

    expect(send).toHaveBeenCalledWith({
      method: "GET",
      path: `/application-reviews/${APPLICATION_ID}/decisions`
    });
  });

  it("resolves null for a truthful 404 instead of throwing", async () => {
    const { port } = httpRejects(new HttpClientError("http", 404, undefined, "not_found"));
    await expect(new HttpHumanDecisionGateway(port).readLatest(APPLICATION_ID)).resolves.toBeNull();
  });

  it.each([
    ["missing decision", { other: 1 }],
    ["extra keys", { decision: record, extra: 1 }],
    ["broken record", { decision: { ...record, decidedAt: "yesterday" } }]
  ])("throws on a drifted 200 body: %s", async (_name, body) => {
    const { port } = http(body, 200);
    await expect(new HttpHumanDecisionGateway(port).readLatest(APPLICATION_ID)).rejects.toThrow();
  });

  it.each([
    ["service unavailable", new HttpClientError("http", 503, undefined, "unavailable")],
    ["network failure", new HttpClientError("network")]
  ])("throws on a %s and never fabricates a record", async (_name, error) => {
    const { port } = httpRejects(error);
    await expect(new HttpHumanDecisionGateway(port).readLatest(APPLICATION_ID)).rejects.toBe(error);
  });
});
