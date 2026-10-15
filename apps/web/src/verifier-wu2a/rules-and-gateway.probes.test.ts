import { describe, expect, it, vi } from "vitest";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import { HttpClientError, type HttpClientPort } from "@/application/ports/http-client-port";
import { HttpSmeRequestGateway } from "@/infrastructure/sme/http-sme-request-gateway";
import { canRegisterCompany } from "@/application/company/can-register-company";

const APP_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

function client(body: unknown): HttpClientPort {
  return { send: vi.fn().mockResolvedValue({ status: 200, body }) };
}
function failing(err: unknown): HttpClientPort {
  return { send: vi.fn().mockRejectedValue(err) };
}

// ---- S1/S2/S3 rule: probe every state the contract defines + boundaries ----
const ALL: readonly ApplicationReviewState[] = [
  "draft",
  "awaiting_assessment",
  "human_review",
  "approved",
  "changes_requested",
  "rejected"
];

describe("PROBE canRegisterCompany (S1-hide/S2/S3)", () => {
  it("shows ONLY for the Sin-enviar set {undefined, null, draft}", () => {
    const shown = ALL.filter((s) => canRegisterCompany(s));
    expect(shown).toEqual(["draft"]);
    expect(canRegisterCompany(undefined)).toBe(true); // unknown read, never a refusal (#480)
    expect(canRegisterCompany(null)).toBe(true); // no application
  });

  it("hides for each post-submission state, one by one", () => {
    for (const s of ["awaiting_assessment", "human_review", "approved", "changes_requested", "rejected"] as const) {
      expect(canRegisterCompany(s), `state ${s}`).toBe(false);
    }
  });
});

// ---- S6/§3: loadMine strict parse + failure mapping ----
describe("PROBE HttpSmeRequestGateway.loadMine", () => {
  it("parses a success body strictly", async () => {
    const out = await new HttpSmeRequestGateway(
      client({ application: { applicationId: APP_ID, state: "human_review" } })
    ).loadMine();
    expect(out).toEqual({ ok: true, application: { applicationId: APP_ID, state: "human_review" } });
  });

  it("resolves an owned absence as {ok:true, application:null}", async () => {
    expect(await new HttpSmeRequestGateway(client({ application: null })).loadMine()).toEqual({
      ok: true,
      application: null
    });
  });

  it("refuses malformed success bodies (never trusted) -> unavailable", async () => {
    const malformed: unknown[] = [
      { application: { applicationId: APP_ID, state: "human_review", objectPath: "s3://leak" } }, // leaked secret
      { application: { applicationId: "not-a-uuid", state: "draft" } },
      { application: { applicationId: APP_ID, state: "invented" } },
      { application: { applicationId: APP_ID } }, // missing state
      { application: { state: "draft" } }, // missing id
      { notTheContract: true },
      { application: null, ownerUserId: "leak" }, // extra top-level key on strictObject
      {},
      null,
      "a string"
    ];
    for (const body of malformed) {
      const out = await new HttpSmeRequestGateway(client(body)).loadMine();
      expect(out, JSON.stringify(body)).toEqual({ ok: false, code: "unavailable" });
    }
  });

  it("maps 401/403 -> unauthenticated, other non-200 -> unavailable, transport -> network", async () => {
    expect(await new HttpSmeRequestGateway(failing(new HttpClientError("http", 401))).loadMine()).toEqual({
      ok: false,
      code: "unauthenticated"
    });
    expect(await new HttpSmeRequestGateway(failing(new HttpClientError("http", 403))).loadMine()).toEqual({
      ok: false,
      code: "unauthenticated"
    });
    for (const status of [400, 404, 409, 422, 500, 503]) {
      expect(await new HttpSmeRequestGateway(failing(new HttpClientError("http", status))).loadMine(), `status ${status}`).toEqual({
        ok: false,
        code: "unavailable"
      });
    }
    expect(await new HttpSmeRequestGateway(failing(new HttpClientError("network"))).loadMine()).toEqual({
      ok: false,
      code: "network"
    });
  });

  it("never throws on any failure (returns a code instead)", async () => {
    const cases: unknown[] = [
      new HttpClientError("http", 401),
      new HttpClientError("http", 503),
      new HttpClientError("network"),
      new Error("raw"),
      undefined
    ];
    for (const e of cases) {
      await expect(new HttpSmeRequestGateway(failing(e)).loadMine()).resolves.toBeDefined();
    }
  });
});
