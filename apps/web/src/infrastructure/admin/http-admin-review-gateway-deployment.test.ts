import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpAdminReviewGateway } from "./http-admin-review-gateway";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_ID = "77777777-7777-4777-8777-777777777777";
const URL = `/application-reviews/${APPLICATION_ID}/deployment`;

const WIRE_CONFIRMED = {
  applicationId: APPLICATION_ID,
  state: "confirmed",
  attempts: 1,
  campaignId: CAMPAIGN_ID,
  retryable: false,
  createdAt: "2026-10-07T15:30:00.000Z",
  updatedAt: "2026-10-07T15:31:00.000Z"
};

const WIRE_FAILED = {
  applicationId: APPLICATION_ID,
  state: "failed",
  attempts: 2,
  lastError: "wallet_required",
  retryable: true,
  createdAt: "2026-10-07T15:30:00.000Z",
  updatedAt: "2026-10-07T15:32:00.000Z"
};

interface Call {
  readonly method: "get" | "post";
  readonly url: string;
  readonly body: unknown;
  readonly headers: Record<string, string> | undefined;
}

function fakeClient(result: { status: number; data: unknown } | Error) {
  const calls: Call[] = [];
  const respond = () => {
    if (result instanceof Error) throw result;
    return result;
  };
  const client = {
    get: async (url: string, config: { headers?: Record<string, string> }) => {
      calls.push({ method: "get", url, body: undefined, headers: config.headers });
      return respond();
    },
    post: async (url: string, body: unknown, config: { headers?: Record<string, string> }) => {
      calls.push({ method: "post", url, body, headers: config.headers });
      return respond();
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HttpAdminReviewGateway.getDeployment", () => {
  it("GETs the deployment with the Bearer token and maps optional fields to null", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { deployment: WIRE_FAILED } });
    const result = await new HttpAdminReviewGateway(client, async () => "token-123").getDeployment(APPLICATION_ID);

    expect(calls).toEqual([{ method: "get", url: URL, body: undefined, headers: { Authorization: "Bearer token-123" } }]);
    expect(result).toEqual({
      ok: true,
      deployment: {
        applicationId: APPLICATION_ID,
        state: "failed",
        attempts: 2,
        campaignId: null,
        lastError: "wallet_required",
        retryable: true,
        createdAt: "2026-10-07T15:30:00.000Z",
        updatedAt: "2026-10-07T15:32:00.000Z"
      }
    });
  });

  it("keeps the server's retryable for a stale deploying attempt (U8)", async () => {
    const stale = { ...WIRE_CONFIRMED, state: "deploying", campaignId: undefined, retryable: true };
    const { client } = fakeClient({ status: 200, data: { deployment: stale } });
    const result = await new HttpAdminReviewGateway(client).getDeployment(APPLICATION_ID);
    expect(result).toEqual({
      ok: true,
      deployment: expect.objectContaining({ state: "deploying", retryable: true })
    });
  });

  it("derives retryable from a failed state when an older API omits it, and refuses a non-boolean", async () => {
    const withoutRetryable: Record<string, unknown> = { ...WIRE_FAILED };
    delete withoutRetryable["retryable"];
    const older = fakeClient({ status: 200, data: { deployment: withoutRetryable } });
    expect(await new HttpAdminReviewGateway(older.client).getDeployment(APPLICATION_ID)).toEqual({
      ok: true,
      deployment: expect.objectContaining({ state: "failed", retryable: true })
    });
    const malformed = fakeClient({ status: 200, data: { deployment: { ...WIRE_FAILED, retryable: "yes" } } });
    expect(await new HttpAdminReviewGateway(malformed.client).getDeployment(APPLICATION_ID)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("keeps the campaign id of a confirmed deployment", async () => {
    const { client } = fakeClient({ status: 200, data: { deployment: WIRE_CONFIRMED } });
    const result = await new HttpAdminReviewGateway(client).getDeployment(APPLICATION_ID);
    expect(result).toEqual({
      ok: true,
      deployment: { ...WIRE_CONFIRMED, lastError: null }
    });
  });

  it("maps 404 to not_found, other statuses to unavailable and a throw to network", async () => {
    const cases: Array<[{ status: number; data: unknown } | Error, string]> = [
      [{ status: 404, data: { code: "not_found" } }, "not_found"],
      [{ status: 503, data: { code: "unavailable" } }, "unavailable"],
      [{ status: 400, data: { code: "invalid_request" } }, "unavailable"],
      [{ status: 500, data: "boom" }, "unavailable"],
      [new Error("socket hang up"), "network"]
    ];
    for (const [response, code] of cases) {
      const { client } = fakeClient(response);
      expect(await new HttpAdminReviewGateway(client).getDeployment(APPLICATION_ID)).toEqual({ ok: false, code });
    }
  });

  it.each([
    ["another application", { ...WIRE_CONFIRMED, applicationId: "33333333-3333-4333-8333-333333333333" }],
    ["an unknown state", { ...WIRE_CONFIRMED, state: "published" }],
    ["negative attempts", { ...WIRE_CONFIRMED, attempts: -1 }],
    ["fractional attempts", { ...WIRE_CONFIRMED, attempts: 1.5 }],
    ["a non-uuid campaign id", { ...WIRE_CONFIRMED, campaignId: "CABC" }],
    ["a non-string last error", { ...WIRE_FAILED, lastError: 42 }],
    ["a missing timestamp", { ...WIRE_CONFIRMED, updatedAt: undefined }]
  ])("refuses a body with %s", async (_label, deployment) => {
    const { client } = fakeClient({ status: 200, data: { deployment } });
    expect(await new HttpAdminReviewGateway(client).getDeployment(APPLICATION_ID)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("refuses a body without the deployment envelope", async () => {
    const { client } = fakeClient({ status: 200, data: WIRE_CONFIRMED });
    expect(await new HttpAdminReviewGateway(client).getDeployment(APPLICATION_ID)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("does not send a request for an id the API would never accept", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { deployment: WIRE_CONFIRMED } });
    expect(await new HttpAdminReviewGateway(client).getDeployment("nope")).toEqual({ ok: false, code: "not_found" });
    expect(calls).toHaveLength(0);
  });
});

describe("HttpAdminReviewGateway.deploy", () => {
  it("POSTs with no body fields and the Bearer token, returning the deployment", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { deployment: WIRE_CONFIRMED } });
    const result = await new HttpAdminReviewGateway(client, async () => "token-123").deploy(APPLICATION_ID);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("post");
    expect(calls[0]!.url).toBe(URL);
    expect(calls[0]!.body).toStrictEqual({});
    expect(calls[0]!.headers).toEqual({ Authorization: "Bearer token-123" });
    expect(result).toEqual({ ok: true, deployment: { ...WIRE_CONFIRMED, lastError: null } });
  });

  it("maps 404 to application_not_found and 409 to application_not_approved", async () => {
    const notFound = fakeClient({ status: 404, data: { code: "application_not_found" } });
    expect(await new HttpAdminReviewGateway(notFound.client).deploy(APPLICATION_ID)).toEqual({
      ok: false,
      code: "application_not_found"
    });
    const notApproved = fakeClient({ status: 409, data: { code: "application_not_approved" } });
    expect(await new HttpAdminReviewGateway(notApproved.client).deploy(APPLICATION_ID)).toEqual({
      ok: false,
      code: "application_not_approved"
    });
  });

  it("maps the 409 deployment_in_progress to its own code (U8)", async () => {
    const inProgress = fakeClient({ status: 409, data: { code: "deployment_in_progress" } });
    expect(await new HttpAdminReviewGateway(inProgress.client).deploy(APPLICATION_ID)).toEqual({
      ok: false,
      code: "deployment_in_progress"
    });
  });

  it.each(["owner_unresolved", "terms_unavailable", "wallet_required", "goal_limit_exceeded"])(
    "keeps the 422 code %s",
    async (code) => {
      const { client } = fakeClient({ status: 422, data: { code } });
      expect(await new HttpAdminReviewGateway(client).deploy(APPLICATION_ID)).toEqual({ ok: false, code });
    }
  );

  it("maps an unknown 422 code to unavailable", async () => {
    const { client } = fakeClient({ status: 422, data: { code: "something_else", message: "provider text" } });
    expect(await new HttpAdminReviewGateway(client).deploy(APPLICATION_ID)).toEqual({ ok: false, code: "unavailable" });
  });

  it("maps the 503 variants, other statuses, malformed bodies and a throw", async () => {
    const cases: Array<[{ status: number; data: unknown } | Error, string]> = [
      [{ status: 503, data: { code: "rate_unavailable" } }, "rate_unavailable"],
      [{ status: 503, data: { code: "unavailable" } }, "unavailable"],
      [{ status: 503, data: "Service Unavailable" }, "unavailable"],
      [{ status: 400, data: { code: "invalid_request" } }, "unavailable"],
      [{ status: 500, data: "boom" }, "unavailable"],
      [{ status: 200, data: { deployment: { ...WIRE_CONFIRMED, state: "done" } } }, "unavailable"],
      [new Error("socket hang up"), "network"]
    ];
    for (const [response, code] of cases) {
      const { client } = fakeClient(response);
      expect(await new HttpAdminReviewGateway(client).deploy(APPLICATION_ID)).toEqual({ ok: false, code });
    }
  });

  it("does not send a request for an id the API would never accept", async () => {
    const { client, calls } = fakeClient({ status: 200, data: { deployment: WIRE_CONFIRMED } });
    expect(await new HttpAdminReviewGateway(client).deploy("nope")).toEqual({
      ok: false,
      code: "application_not_found"
    });
    expect(calls).toHaveLength(0);
  });
});
