import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { HttpAdminReviewGateway } from "./http-admin-review-gateway";
import { UNAVAILABLE_ADMIN_REVIEW_PORT } from "./unavailable-admin-review-port";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_APPLICATION_ID = "33333333-3333-4333-8333-333333333333";
const URL = `/application-reviews/${APPLICATION_ID}/evidence`;
const HASH = "a".repeat(64);

const WIRE = {
  applicationId: APPLICATION_ID,
  applicationState: "approved",
  smeReference: "sme-001",
  companyName: "Panadería Horizonte SRL",
  decision: null,
  deployment: null,
  vault: null,
  contributions: [
    {
      transactionHash: HASH,
      investorAccountId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      amountStroops: "2505000000",
      observedAt: "2026-10-08T10:05:00.000Z",
      explorerUrl: null
    }
  ],
  distributions: [],
  reconciliation: null
};

function fakeClient(result: { status: number; data: unknown } | Error) {
  const calls: { url: string; headers: Record<string, string> | undefined }[] = [];
  const client = {
    get: async (url: string, config: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: config.headers });
      if (result instanceof Error) throw result;
      return result;
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

describe("HttpAdminReviewGateway.getEvidence", () => {
  it("GETs the evidence with the Bearer token and returns the parsed chain", async () => {
    const { client, calls } = fakeClient({ status: 200, data: WIRE });
    const result = await new HttpAdminReviewGateway(client, async () => "token-123").getEvidence(APPLICATION_ID);

    expect(calls).toEqual([{ url: URL, headers: { Authorization: "Bearer token-123" } }]);
    expect(result).toEqual({ ok: true, evidence: WIRE });
  });

  it("is not_found on a 404, and without a request for an id the API would refuse", async () => {
    const missing = fakeClient({ status: 404, data: { code: "not_found" } });
    expect(await new HttpAdminReviewGateway(missing.client).getEvidence(APPLICATION_ID)).toEqual({
      ok: false,
      code: "not_found"
    });

    const invalid = fakeClient({ status: 200, data: WIRE });
    expect(await new HttpAdminReviewGateway(invalid.client).getEvidence("not-a-uuid")).toEqual({
      ok: false,
      code: "not_found"
    });
    expect(invalid.calls).toEqual([]);
  });

  it("collapses a 503 to the sanitized unavailable without echoing the body", async () => {
    const { client } = fakeClient({ status: 503, data: { code: "unavailable", message: "db password leaked" } });
    const result = await new HttpAdminReviewGateway(client).getEvidence(APPLICATION_ID);
    expect(result).toEqual({ ok: false, code: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("leaked");
  });

  it("is unavailable when the body breaks the contract or names another application", async () => {
    const malformed = fakeClient({ status: 200, data: { ...WIRE, contributions: [{ transactionHash: "nope" }] } });
    expect(await new HttpAdminReviewGateway(malformed.client).getEvidence(APPLICATION_ID)).toEqual({
      ok: false,
      code: "unavailable"
    });

    const extra = fakeClient({ status: 200, data: { ...WIRE, secret: "x" } });
    expect(await new HttpAdminReviewGateway(extra.client).getEvidence(APPLICATION_ID)).toEqual({
      ok: false,
      code: "unavailable"
    });

    const other = fakeClient({ status: 200, data: { ...WIRE, applicationId: OTHER_APPLICATION_ID } });
    expect(await new HttpAdminReviewGateway(other.client).getEvidence(APPLICATION_ID)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("is network when the transport throws", async () => {
    const { client } = fakeClient(new Error("ECONNRESET"));
    expect(await new HttpAdminReviewGateway(client).getEvidence(APPLICATION_ID)).toEqual({
      ok: false,
      code: "network"
    });
  });

  it("is unavailable from the null-object port", async () => {
    expect(await UNAVAILABLE_ADMIN_REVIEW_PORT.getEvidence(APPLICATION_ID)).toEqual({ ok: false, code: "unavailable" });
  });
});
