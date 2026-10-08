import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import type { RecordDecisionRequest } from "@/application/ports/admin-review-port";
import { HttpAdminReviewGateway } from "./http-admin-review-gateway";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const DECISION_ID = "44444444-4444-4444-8444-444444444444";
const URL = `/application-reviews/${APPLICATION_ID}/decisions`;

const REQUEST: RecordDecisionRequest = {
  decisionId: DECISION_ID,
  outcome: "approved",
  reason: "Ventas consistentes con lo declarado.",
  approvedLimitArs: 12_000_000
};

const RECORD = {
  decisionId: DECISION_ID,
  applicationId: APPLICATION_ID,
  outcome: "approved",
  actor: "Admin Vaqcrow",
  reason: "Ventas consistentes con lo declarado.",
  approvedLimitArs: 12_000_000,
  decidedAt: "2026-10-07T15:30:00.000Z",
  correlationId: "66666666-6666-4666-8666-666666666666"
};

interface PostCall {
  readonly url: string;
  readonly body: unknown;
  readonly headers: Record<string, string> | undefined;
}

function fakePostClient(result: { status: number; data: unknown } | Error) {
  const calls: PostCall[] = [];
  const client = {
    post: async (url: string, body: unknown, config: { headers?: Record<string, string> }) => {
      calls.push({ url, body, headers: config.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HttpAdminReviewGateway.recordDecision", () => {
  it("POSTs exactly { decisionId, outcome, reason, approvedLimitArs } with the Bearer token, never an actor", async () => {
    const { client, calls } = fakePostClient({ status: 201, data: { applied: true, decision: RECORD } });
    const gateway = new HttpAdminReviewGateway(client, async () => "token-123");

    const result = await gateway.recordDecision(APPLICATION_ID, REQUEST);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(URL);
    expect(calls[0]!.body).toStrictEqual({
      decisionId: DECISION_ID,
      outcome: "approved",
      reason: "Ventas consistentes con lo declarado.",
      approvedLimitArs: 12_000_000
    });
    expect(Object.keys(calls[0]!.body as object)).not.toContain("actor");
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
    expect(result).toEqual({ ok: true, applied: true, decision: RECORD });
  });

  it("drops any extra key a caller smuggles in", async () => {
    const { client, calls } = fakePostClient({ status: 201, data: { applied: true, decision: RECORD } });
    const smuggled = { ...REQUEST, actor: "Otro" } as RecordDecisionRequest;
    await new HttpAdminReviewGateway(client).recordDecision(APPLICATION_ID, smuggled);
    expect(Object.keys(calls[0]!.body as object).sort()).toEqual(["approvedLimitArs", "decisionId", "outcome", "reason"]);
  });

  it("keeps applied: false for a 200 replay", async () => {
    const { client } = fakePostClient({ status: 200, data: { applied: false, decision: RECORD } });
    expect(await new HttpAdminReviewGateway(client).recordDecision(APPLICATION_ID, REQUEST)).toEqual({
      ok: true,
      applied: false,
      decision: RECORD
    });
  });

  it("refuses a success body for another decision or application", async () => {
    const other = fakePostClient({ status: 201, data: { applied: true, decision: { ...RECORD, decisionId: "55555555-5555-4555-8555-555555555555" } } });
    expect(await new HttpAdminReviewGateway(other.client).recordDecision(APPLICATION_ID, REQUEST)).toEqual({
      ok: false,
      code: "unavailable"
    });
    const malformed = fakePostClient({ status: 201, data: { applied: "yes", decision: RECORD } });
    expect(await new HttpAdminReviewGateway(malformed.client).recordDecision(APPLICATION_ID, REQUEST)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("maps 409 state_conflict with its actual state", async () => {
    const { client } = fakePostClient({ status: 409, data: { code: "state_conflict", actualState: "approved" } });
    expect(await new HttpAdminReviewGateway(client).recordDecision(APPLICATION_ID, REQUEST)).toEqual({
      ok: false,
      code: "state_conflict",
      actualState: "approved"
    });
  });

  it("maps 409 idempotency_conflict, and an unknown 409 to unavailable", async () => {
    const idem = fakePostClient({ status: 409, data: { code: "idempotency_conflict" } });
    expect(await new HttpAdminReviewGateway(idem.client).recordDecision(APPLICATION_ID, REQUEST)).toEqual({
      ok: false,
      code: "idempotency_conflict"
    });
    const odd = fakePostClient({ status: 409, data: { code: "state_conflict", actualState: "bogus" } });
    expect(await new HttpAdminReviewGateway(odd.client).recordDecision(APPLICATION_ID, REQUEST)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("maps 400, 404, 503 and a transport failure to sanitized codes", async () => {
    const cases: Array<[{ status: number; data: unknown } | Error, string]> = [
      [{ status: 400, data: { code: "invalid_request" } }, "invalid_request"],
      [{ status: 404, data: { code: "not_found" } }, "not_found"],
      [{ status: 503, data: { code: "unavailable", message: "db down" } }, "unavailable"],
      [{ status: 500, data: "boom" }, "unavailable"],
      [new Error("socket hang up"), "network"]
    ];
    for (const [response, code] of cases) {
      const { client } = fakePostClient(response);
      expect(await new HttpAdminReviewGateway(client).recordDecision(APPLICATION_ID, REQUEST)).toEqual({ ok: false, code });
    }
  });

  it("does not send a request for an id the API would never accept", async () => {
    const { client, calls } = fakePostClient({ status: 201, data: { applied: true, decision: RECORD } });
    const gateway = new HttpAdminReviewGateway(client);
    expect(await gateway.recordDecision("nope", REQUEST)).toEqual({ ok: false, code: "not_found" });
    expect(calls).toHaveLength(0);
  });
});
