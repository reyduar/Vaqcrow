import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type {
  InvestorKycApproveResult,
  InvestorKycReadResult,
  InvestorKycRepositoryPort
} from "../../../application/ports/investor-kyc-repository-port.js";
import { buildApp } from "../build-app.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";

/**
 * The investor's simulated KYC surface (#422/WU4): `GET /investor-kyc` reads the
 * caller's state (a missing record is `approved: false`, never an error);
 * `POST /investor-kyc` records the simulated approval. Both are AUTHENTICATED
 * and the owner is always `request.principal.userId` — a query-supplied user is
 * ignored. `POST` is idempotent: 201 on create, 200 on replay, and the strict
 * body never carries the `created` status field.
 */
const CALLER_ID = principalFor("INVERSOR").userId;
const OTHER_ID = principalFor("PYME").userId;
const APPROVED_AT = "2026-10-08T18:30:00.000Z";

interface FakeRepository {
  readonly kyc: InvestorKycRepositoryPort;
  readonly findCalls: string[];
  readonly approveCalls: string[];
}

function fakeRepository(overrides: Partial<InvestorKycRepositoryPort> = {}): FakeRepository {
  const findCalls: string[] = [];
  const approveCalls: string[] = [];

  const kyc: InvestorKycRepositoryPort = {
    find: async (userId): Promise<InvestorKycReadResult> => {
      findCalls.push(userId);
      return { ok: true, value: null };
    },
    approve: async (userId): Promise<InvestorKycApproveResult> => {
      approveCalls.push(userId);
      return { ok: true, value: { approvedAt: APPROVED_AT, simulado: true, created: true } };
    },
    ...overrides
  };

  return { kyc, findCalls, approveCalls };
}

function deps(kyc: InvestorKycRepositoryPort): { investorKyc: { kyc: InvestorKycRepositoryPort } } {
  return { investorKyc: { kyc } };
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /investor-kyc", () => {
  it("answers approved:false with a null date when there is no record", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", deps(fake.kyc));

    const response = await app.inject({ method: "GET", url: "/investor-kyc" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ approved: false, approvedAt: null, simulado: true });
    expect(fake.findCalls).toEqual([CALLER_ID]);
  });

  it("answers the stored approved record", async () => {
    const fake = fakeRepository({
      find: async () => ({ ok: true, value: { approvedAt: APPROVED_AT, simulado: true } })
    });
    app = buildAppAs("INVERSOR", deps(fake.kyc));

    const response = await app.inject({ method: "GET", url: "/investor-kyc" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ approved: true, approvedAt: APPROVED_AT, simulado: true });
  });

  it("uses the verified principal, never a query user", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", deps(fake.kyc));

    await app.inject({ method: "GET", url: `/investor-kyc?userId=${OTHER_ID}` });

    expect(fake.findCalls).toEqual([CALLER_ID]);
    expect(fake.findCalls).not.toContain(OTHER_ID);
  });

  it("answers 503 instead of a false 'not approved' when the repository is unavailable", async () => {
    const fake = fakeRepository({ find: async () => ({ ok: false, error: { code: "unavailable" } }) });
    app = buildAppAs("INVERSOR", deps(fake.kyc));

    const response = await app.inject({ method: "GET", url: "/investor-kyc" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("answers 401 without a token", async () => {
    const fake = fakeRepository();
    app = buildApp(deps(fake.kyc));

    const response = await app.inject({ method: "GET", url: "/investor-kyc" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
    expect(fake.findCalls).toHaveLength(0);
  });
});

describe("POST /investor-kyc", () => {
  it("creates the record for the caller and answers 201", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", deps(fake.kyc));

    const response = await app.inject({ method: "POST", url: "/investor-kyc" });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ approved: true, approvedAt: APPROVED_AT, simulado: true });
    expect(fake.approveCalls).toEqual([CALLER_ID]);
  });

  it("is idempotent: a replay answers 200 with the existing record", async () => {
    const fake = fakeRepository({
      approve: async () => ({ ok: true, value: { approvedAt: APPROVED_AT, simulado: true, created: false } })
    });
    app = buildAppAs("INVERSOR", deps(fake.kyc));

    const response = await app.inject({ method: "POST", url: "/investor-kyc" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ approved: true, approvedAt: APPROVED_AT, simulado: true });
  });

  it("uses the verified principal, never a body user", async () => {
    const fake = fakeRepository();
    app = buildAppAs("INVERSOR", deps(fake.kyc));

    await app.inject({ method: "POST", url: "/investor-kyc", payload: { userId: OTHER_ID } });

    expect(fake.approveCalls).toEqual([CALLER_ID]);
    expect(fake.approveCalls).not.toContain(OTHER_ID);
  });

  it("answers 503 when the repository reports unavailable", async () => {
    const fake = fakeRepository({ approve: async () => ({ ok: false, error: { code: "unavailable" } }) });
    app = buildAppAs("INVERSOR", deps(fake.kyc));

    const response = await app.inject({ method: "POST", url: "/investor-kyc" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("answers 401 without a token", async () => {
    const fake = fakeRepository();
    app = buildApp(deps(fake.kyc));

    const response = await app.inject({ method: "POST", url: "/investor-kyc" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
    expect(fake.approveCalls).toHaveLength(0);
  });
});
