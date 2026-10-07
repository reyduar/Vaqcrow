import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { correlationIdSchema } from "@vaqcrow/contracts";
import type { CampaignDeploymentRecord, CampaignDeploymentRepositoryPort } from "../../../application/ports/campaign-deployment-repository-port.js";
import type { DeployApprovedCampaignResult } from "../../../application/use-cases/deploy-approved-campaign.js";
import { bearer, buildAppAs } from "../test-support/auth.js";
import type { CampaignDeploymentRouteDependencies } from "./campaign-deployment.route.js";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const CALLER_CORRELATION_ID = "123e4567-e89b-42d3-a456-426614174000";
const STORED_CORRELATION_ID = "123e4567-e89b-42d3-a456-4266141740bb";
const AT = "2026-10-06T12:00:00.000Z";

function record(overrides: Partial<CampaignDeploymentRecord> = {}): CampaignDeploymentRecord {
  return {
    applicationId: APPLICATION_ID as CampaignDeploymentRecord["applicationId"],
    state: "pending",
    attempts: 0,
    lastCorrelationId: STORED_CORRELATION_ID as CampaignDeploymentRecord["lastCorrelationId"],
    createdAt: AT,
    updatedAt: AT,
    ...overrides
  };
}

function deploymentsReading(result: {
  readonly ok: true;
  readonly value: CampaignDeploymentRecord;
} | {
  readonly ok: false;
  readonly error: { readonly code: "not_found" | "unavailable" };
}): CampaignDeploymentRepositoryPort {
  return {
    findByApplicationId: vi
      .fn<CampaignDeploymentRepositoryPort["findByApplicationId"]>()
      .mockResolvedValue(result),
    markPending: vi.fn<CampaignDeploymentRepositoryPort["markPending"]>(),
    beginAttempt: vi.fn<CampaignDeploymentRepositoryPort["beginAttempt"]>(),
    markConfirmed: vi.fn<CampaignDeploymentRepositoryPort["markConfirmed"]>(),
    markFailed: vi.fn<CampaignDeploymentRepositoryPort["markFailed"]>()
  };
}

function route(
  deployResult: DeployApprovedCampaignResult,
  deployments: CampaignDeploymentRepositoryPort = deploymentsReading({
    ok: true,
    value: record()
  })
): {
  readonly dependencies: CampaignDeploymentRouteDependencies;
  readonly deploy: ReturnType<typeof vi.fn<CampaignDeploymentRouteDependencies["deploy"]>>;
} {
  const deploy = vi
    .fn<CampaignDeploymentRouteDependencies["deploy"]>()
    .mockResolvedValue(deployResult);
  return { dependencies: { deployments, deploy }, deploy };
}

describe("POST /application-reviews/:applicationId/deployment", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("deploys and answers the confirmed deployment", async () => {
    const confirmed = record({ state: "confirmed", attempts: 1, campaignId: CAMPAIGN_ID });
    const { dependencies, deploy } = route({ ok: true, value: { deployment: confirmed } });
    app = buildAppAs("ADMIN", { campaignDeployment: dependencies });

    const response = await app.inject({
      method: "POST",
      url: `/application-reviews/${APPLICATION_ID}/deployment`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      deployment: {
        applicationId: APPLICATION_ID,
        state: "confirmed",
        attempts: 1,
        campaignId: CAMPAIGN_ID,
        createdAt: AT,
        updatedAt: AT
      }
    });
    expect(deploy).toHaveBeenCalledTimes(1);
    const input = deploy.mock.calls[0]?.[0];
    expect(input?.applicationId).toBe(APPLICATION_ID);
    expect(correlationIdSchema.safeParse(input?.correlationId).success).toBe(true);
  });

  it("does not reuse a caller-supplied correlation id", async () => {
    const { dependencies, deploy } = route({ ok: true, value: { deployment: record({ state: "confirmed" }) } });
    app = buildAppAs("ADMIN", { campaignDeployment: dependencies });

    await app.inject({
      method: "POST",
      url: `/application-reviews/${APPLICATION_ID}/deployment`,
      headers: { "x-correlation-id": CALLER_CORRELATION_ID }
    });

    expect(deploy.mock.calls[0]?.[0].correlationId).not.toBe(CALLER_CORRELATION_ID);
  });

  it.each([
    ["application_not_found", 404],
    ["application_not_approved", 409],
    ["owner_unresolved", 422],
    ["terms_unavailable", 422],
    ["wallet_required", 422],
    ["goal_limit_exceeded", 422],
    ["rate_unavailable", 503],
    ["unavailable", 503]
  ] as const)("maps %s to status %s with a sanitized body", async (code, status) => {
    const { dependencies } = route({ ok: false, error: { code } });
    app = buildAppAs("ADMIN", { campaignDeployment: dependencies });

    const response = await app.inject({
      method: "POST",
      url: `/application-reviews/${APPLICATION_ID}/deployment`
    });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ code });
    expect(response.body).not.toContain("message");
  });

  it("rejects a malformed application id with 400 before deploying", async () => {
    const { dependencies, deploy } = route({ ok: true, value: { deployment: record() } });
    app = buildAppAs("ADMIN", { campaignDeployment: dependencies });

    const response = await app.inject({
      method: "POST",
      url: "/application-reviews/not-an-id/deployment"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(deploy).not.toHaveBeenCalled();
  });

  it("forbids a non-admin caller", async () => {
    const { dependencies, deploy } = route({ ok: true, value: { deployment: record() } });
    app = buildAppAs("PYME", { campaignDeployment: dependencies });

    const response = await app.inject({
      method: "POST",
      url: `/application-reviews/${APPLICATION_ID}/deployment`,
      headers: bearer("PYME")
    });

    expect(response.statusCode).toBe(403);
    expect(deploy).not.toHaveBeenCalled();
  });
});

describe("GET /application-reviews/:applicationId/deployment", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns the read-only deployment detail", async () => {
    const failed = record({ state: "failed", attempts: 2, lastError: "rate_unavailable" });
    const { dependencies } = route({ ok: true, value: { deployment: failed } }, deploymentsReading({ ok: true, value: failed }));
    app = buildAppAs("ADMIN", { campaignDeployment: dependencies });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/deployment`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      deployment: {
        applicationId: APPLICATION_ID,
        state: "failed",
        attempts: 2,
        lastError: "rate_unavailable",
        createdAt: AT,
        updatedAt: AT
      }
    });
    // The internal correlation id never crosses the wire.
    expect(response.body).not.toContain(STORED_CORRELATION_ID);
  });

  it("reports not_found truthfully when no deployment exists yet", async () => {
    const { dependencies } = route({ ok: true, value: { deployment: record() } }, deploymentsReading({ ok: false, error: { code: "not_found" } }));
    app = buildAppAs("ADMIN", { campaignDeployment: dependencies });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/deployment`
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("maps an unavailable read to a sanitized 503", async () => {
    const { dependencies } = route({ ok: true, value: { deployment: record() } }, deploymentsReading({ ok: false, error: { code: "unavailable" } }));
    app = buildAppAs("ADMIN", { campaignDeployment: dependencies });

    const response = await app.inject({
      method: "GET",
      url: `/application-reviews/${APPLICATION_ID}/deployment`
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("rejects a malformed application id with 400", async () => {
    const { dependencies } = route({ ok: true, value: { deployment: record() } });
    app = buildAppAs("ADMIN", { campaignDeployment: dependencies });

    const response = await app.inject({
      method: "GET",
      url: "/application-reviews/not-an-id/deployment"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });
});
