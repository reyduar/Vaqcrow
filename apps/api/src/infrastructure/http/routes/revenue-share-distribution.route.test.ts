import {
  correlationIdSchema,
  parseCorrelationId,
  parseRevenueShareDistributionId
} from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RevenueShareDistributionRecord } from "../../../application/ports/revenue-share-distribution-repository-port.js";
import type {
  BuiltRevenueShareDistributionXdr,
  RevenueShareDistributionXdrPort,
  RevenueShareDistributionXdrResult,
  VerifiedRevenueShareDistributionXdr
} from "../../../application/ports/revenue-share-distribution-xdr-port.js";
import type {
  LedgerAccount,
  LedgerPort,
  LedgerResult
} from "../../../application/ports/ledger-port.js";
import { buildApp } from "../build-app.js";
import type { RevenueShareDistributionRouteDependencies } from "./revenue-share-distribution.route.js";

const DISTRIBUTION_ID = "123e4567-e89b-42d3-a456-4266141740ab";
const APPLICATION_ID = "87654321-4321-4abc-8def-123456789abc";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ACCOUNT_ID = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const RECIPIENT_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const RECIPIENT_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const UNSIGNED_XDR = "AAAAAgAAAABfakeUnsignedDistributionEnvelope";
const SIGNED_XDR = "AAAAAgAAAABfakeSignedDistributionEnvelope";
const TRANSACTION_HASH = "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";
const EXPIRES_AT = "2026-09-21T12:00:00.000Z";
const EXPLORER_BASE_URL = "https://stellar.expert/explorer/testnet";

/** A stroop count above 2^53, so the wire encoding cannot survive as a float. */
const LARGE_AMOUNT = "9007199254740993";
const SMALL_AMOUNT = "10000000";

const prepareBody = {
  sourceAccountId: SOURCE_ACCOUNT_ID,
  recipients: [
    { accountId: RECIPIENT_A, amountStroops: LARGE_AMOUNT },
    { accountId: RECIPIENT_B, amountStroops: SMALL_AMOUNT }
  ],
  memo: null,
  applicationId: null
};

const terms = {
  network: "testnet",
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567891",
  memo: null,
  expiresAt: EXPIRES_AT,
  recipients: [
    { accountId: RECIPIENT_A, amountStroops: LARGE_AMOUNT },
    { accountId: RECIPIENT_B, amountStroops: SMALL_AMOUNT }
  ]
};

/** The terms as the use cases hold them: the contract parses amounts to `bigint`. */
const parsedRecipients = [
  { accountId: RECIPIENT_A, amountStroops: 9_007_199_254_740_993n },
  { accountId: RECIPIENT_B, amountStroops: 10_000_000n }
];

const parsedTerms = { ...terms, recipients: parsedRecipients };

const submissionBody = { signedXdr: SIGNED_XDR, terms, applicationId: null };

const account: LedgerAccount = {
  accountId: SOURCE_ACCOUNT_ID,
  sequence: "1234567890",
  nativeBalanceStroops: 50_000_000n
};

const built: BuiltRevenueShareDistributionXdr = {
  xdr: UNSIGNED_XDR,
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567891",
  recipients: parsedRecipients,
  memo: null,
  expiresAt: EXPIRES_AT
};

const verified: VerifiedRevenueShareDistributionXdr = {
  transactionHash: TRANSACTION_HASH,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  recipients: parsedRecipients,
  memo: null,
  expiresAt: EXPIRES_AT
};

const wireRecipients = [
  { accountId: RECIPIENT_A, amountStroops: LARGE_AMOUNT },
  { accountId: RECIPIENT_B, amountStroops: SMALL_AMOUNT }
];

/** The prepared shape as it crosses the wire: recipient amounts are decimal strings. */
const wirePreparedDistribution = {
  distributionId: DISTRIBUTION_ID,
  xdr: UNSIGNED_XDR,
  network: "testnet",
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567891",
  memo: null,
  expiresAt: EXPIRES_AT,
  recipients: wireRecipients,
  applicationId: null
};

const snapshot: RevenueShareDistributionRecord = {
  distributionId: DISTRIBUTION_ID,
  network: "testnet",
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567891",
  recipients: parsedRecipients,
  expiresAt: EXPIRES_AT,
  signedXdr: SIGNED_XDR,
  transactionHash: TRANSACTION_HASH,
  state: "submitted",
  lastCorrelationId: parseCorrelationId(CORRELATION_ID),
  confirmationAttempts: 0,
  nextAttemptAt: "2026-09-21T12:00:10.000Z",
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
};

/** The wire form of a snapshot: recipient amounts are decimal strings, never JSON numbers. */
const wireSnapshot = {
  distributionId: DISTRIBUTION_ID,
  network: "testnet",
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567891",
  memo: null,
  expiresAt: EXPIRES_AT,
  recipients: wireRecipients,
  state: "submitted",
  transactionHash: TRANSACTION_HASH,
  applicationId: null,
  explorerUrl: `${EXPLORER_BASE_URL}/tx/${TRANSACTION_HASH}`,
  failureReason: null,
  lastCorrelationId: CORRELATION_ID,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
};

function ledgerReturning(result: LedgerResult<LedgerAccount>): LedgerPort {
  return { getAccount: vi.fn().mockResolvedValue(result) };
}

function xdrDouble(input: {
  build?: RevenueShareDistributionXdrResult<BuiltRevenueShareDistributionXdr>;
  verify?: RevenueShareDistributionXdrResult<VerifiedRevenueShareDistributionXdr>;
} = {}): RevenueShareDistributionXdrPort {
  return {
    build: vi.fn().mockReturnValue(input.build ?? { ok: true, value: built }),
    verify: vi.fn().mockReturnValue(input.verify ?? { ok: true, value: verified })
  };
}

function repositoryDouble(
  input: {
    submit?: unknown;
    findById?: unknown;
  } = {}
): RevenueShareDistributionRouteDependencies["repository"] {
  return {
    submit: vi
      .fn()
      .mockResolvedValue(input.submit ?? { ok: true, value: { record: snapshot, applied: true } }),
    findById: vi.fn().mockResolvedValue(input.findById ?? { ok: true, value: snapshot })
  };
}

function deps(
  overrides: {
    ledger?: LedgerPort;
    xdr?: RevenueShareDistributionXdrPort;
    repository?: RevenueShareDistributionRouteDependencies["repository"];
  } = {}
): RevenueShareDistributionRouteDependencies {
  return {
    ledger: overrides.ledger ?? ledgerReturning({ ok: true, value: account }),
    xdr: overrides.xdr ?? xdrDouble(),
    repository: overrides.repository ?? repositoryDouble(),
    network: { network: "testnet", networkPassphrase: NETWORK_PASSPHRASE },
    explorerBaseUrl: EXPLORER_BASE_URL,
    generateDistributionId: vi.fn(() => parseRevenueShareDistributionId(DISTRIBUTION_ID))
  };
}

describe("POST /revenue-share-distributions", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns 200 with the prepared distribution, encoding recipient amounts as decimal strings", async () => {
    app = buildApp({ revenueShareDistribution: deps() });

    const response = await app.inject({
      method: "POST",
      url: "/revenue-share-distributions",
      payload: prepareBody
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ distribution: wirePreparedDistribution });
    expect(typeof response.json().distribution.recipients[0].amountStroops).toBe("string");
    expect(response.json().distribution.recipients[0].amountStroops).toBe(LARGE_AMOUNT);
  });

  it("reads the sequence from the ledger and sets a 15-minute lifetime", async () => {
    const xdr = xdrDouble();
    app = buildApp({ revenueShareDistribution: deps({ xdr }) });

    await app.inject({ method: "POST", url: "/revenue-share-distributions", payload: prepareBody });

    const input = vi.mocked(xdr.build).mock.calls[0]?.[0];
    expect(input?.terms.sourceSequence).toBe("1234567890");
    expect(input?.terms.sourceAccountId).toBe(SOURCE_ACCOUNT_ID);
    expect(input?.terms.recipients).toEqual(parsedRecipients);

    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(input?.maxTimeUnixSeconds).toBeGreaterThanOrEqual(nowSeconds + 15 * 60 - 5);
    expect(input?.maxTimeUnixSeconds).toBeLessThanOrEqual(nowSeconds + 15 * 60 + 5);
  });

  const invalidPrepareBodies: ReadonlyArray<readonly [string, object | string]> = [
    ["a missing field", { ...prepareBody, memo: undefined }],
    ["an extra field", { ...prepareBody, unexpected: true }],
    ["a JSON number amount", { ...prepareBody, recipients: [{ ...prepareBody.recipients[0], amountStroops: 10_000_000 }] }],
    ["a zero amount", { ...prepareBody, recipients: [{ ...prepareBody.recipients[0], amountStroops: "0" }] }],
    ["an empty recipient list", { ...prepareBody, recipients: [] }],
    ["duplicate recipients", { ...prepareBody, recipients: [prepareBody.recipients[0], prepareBody.recipients[0]] }],
    ["a recipient equal to the source", { ...prepareBody, recipients: [{ accountId: SOURCE_ACCOUNT_ID, amountStroops: "1" }] }],
    ["a malformed application ID", { ...prepareBody, applicationId: "not-a-uuid" }],
    ["a malformed recipient account", { ...prepareBody, recipients: [{ accountId: "nope", amountStroops: "1" }] }],
    ["an array body", [1, 2, 3]]
  ];

  it.each(invalidPrepareBodies)("rejects %s with 400 invalid_request", async (_description, payload) => {
    app = buildApp({ revenueShareDistribution: deps() });

    const response = await app.inject({
      method: "POST",
      url: "/revenue-share-distributions",
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("does not reach the ledger for a rejected body", async () => {
    const ledger = ledgerReturning({ ok: true, value: account });
    app = buildApp({ revenueShareDistribution: deps({ ledger }) });

    await app.inject({
      method: "POST",
      url: "/revenue-share-distributions",
      payload: { ...prepareBody, extra: true }
    });

    expect(ledger.getAccount).not.toHaveBeenCalled();
  });

  it("maps an unfunded source account to 404 account_not_found", async () => {
    app = buildApp({
      revenueShareDistribution: deps({
        ledger: ledgerReturning({ ok: false, error: { code: "not_found" } })
      })
    });

    const response = await app.inject({
      method: "POST",
      url: "/revenue-share-distributions",
      payload: prepareBody
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "account_not_found" });
  });

  it("maps an unavailable ledger to 503 unavailable", async () => {
    app = buildApp({
      revenueShareDistribution: deps({
        ledger: ledgerReturning({ ok: false, error: { code: "unavailable" } })
      })
    });

    const response = await app.inject({
      method: "POST",
      url: "/revenue-share-distributions",
      payload: prepareBody
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("maps an unbuildable envelope to 400 invalid_request", async () => {
    app = buildApp({
      revenueShareDistribution: deps({
        xdr: xdrDouble({ build: { ok: false, error: { code: "invalid_input" } } })
      })
    });

    const response = await app.inject({
      method: "POST",
      url: "/revenue-share-distributions",
      payload: prepareBody
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("sets the correlation ID header", async () => {
    app = buildApp({ revenueShareDistribution: deps() });

    const response = await app.inject({
      method: "POST",
      url: "/revenue-share-distributions",
      payload: prepareBody
    });

    expect(correlationIdSchema.safeParse(response.headers["x-correlation-id"]).success).toBe(true);
  });
});

describe("POST /revenue-share-distributions/:distributionId/submission", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns 202 with applied=true for a first submission", async () => {
    app = buildApp({ revenueShareDistribution: deps() });

    const response = await app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}/submission`,
      payload: submissionBody
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ applied: true, distribution: wireSnapshot });
  });

  it("returns 200 with applied=false for an exact replay", async () => {
    app = buildApp({
      revenueShareDistribution: deps({
        repository: repositoryDouble({
          submit: { ok: true, value: { record: snapshot, applied: false } }
        })
      })
    });

    const response = await app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}/submission`,
      payload: submissionBody
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ applied: false, distribution: wireSnapshot });
  });

  it("forwards a declared application link to the repository", async () => {
    const repository = repositoryDouble({
      submit: {
        ok: true,
        value: { record: { ...snapshot, applicationId: APPLICATION_ID }, applied: true }
      }
    });
    app = buildApp({ revenueShareDistribution: deps({ repository }) });

    const response = await app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}/submission`,
      payload: { ...submissionBody, applicationId: APPLICATION_ID }
    });

    expect(vi.mocked(repository.submit).mock.calls[0]?.[0].record.applicationId).toBe(APPLICATION_ID);
    expect(response.statusCode).toBe(202);
    expect(response.json().distribution.applicationId).toBe(APPLICATION_ID);
  });

  it("forwards the verified hash, the signed XDR and a generated correlation ID", async () => {
    const repository = repositoryDouble();
    app = buildApp({ revenueShareDistribution: deps({ repository }) });

    const response = await app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}/submission`,
      payload: submissionBody
    });

    const input = vi.mocked(repository.submit).mock.calls[0]?.[0];
    expect(input?.record.transactionHash).toBe(TRANSACTION_HASH);
    expect(input?.record.signedXdr).toBe(SIGNED_XDR);
    expect(input?.record.distributionId).toBe(DISTRIBUTION_ID);
    expect(correlationIdSchema.safeParse(input?.correlationId).success).toBe(true);
    expect(response.headers["x-correlation-id"]).toBe(input?.correlationId);
  });

  it("persists the recipients recovered by verification, never the declared request", async () => {
    const verifiedElsewhere: VerifiedRevenueShareDistributionXdr = {
      ...verified,
      recipients: [
        { accountId: RECIPIENT_B, amountStroops: 10_000_000n },
        { accountId: RECIPIENT_A, amountStroops: 9_007_199_254_740_993n }
      ]
    };
    const repository = repositoryDouble();
    app = buildApp({
      revenueShareDistribution: deps({
        xdr: xdrDouble({ verify: { ok: true, value: verifiedElsewhere } }),
        repository
      })
    });

    await app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}/submission`,
      payload: submissionBody
    });

    expect(vi.mocked(repository.submit).mock.calls[0]?.[0].record.recipients).toEqual(
      verifiedElsewhere.recipients
    );
  });

  it("verifies the envelope against the declared terms", async () => {
    const xdr = xdrDouble();
    app = buildApp({ revenueShareDistribution: deps({ xdr }) });

    await app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}/submission`,
      payload: submissionBody
    });

    expect(xdr.verify).toHaveBeenCalledOnce();
    expect(xdr.verify).toHaveBeenCalledWith({ xdr: SIGNED_XDR, terms: parsedTerms });
  });

  const driftedBodies: ReadonlyArray<readonly [string, object | string]> = [
    ["a body missing signedXdr", { terms, applicationId: null }],
    ["a body missing the application link", { signedXdr: SIGNED_XDR, terms }],
    ["a body with an extra key", { ...submissionBody, extra: true }],
    ["an empty signed XDR", { ...submissionBody, signedXdr: "" }],
    ["a malformed application link", { ...submissionBody, applicationId: "not-a-uuid" }],
    ["terms missing a term", { ...submissionBody, terms: { ...terms, memo: undefined } }],
    ["terms carrying an application link", { ...submissionBody, terms: { ...terms, applicationId: null } }],
    [
      "terms with a non-integer amount",
      { ...submissionBody, terms: { ...terms, recipients: [{ ...terms.recipients[0], amountStroops: "1.5" }] } }
    ],
    ["an empty recipient list", { ...submissionBody, terms: { ...terms, recipients: [] } }]
  ];

  it.each(driftedBodies)("rejects %s with 400 invalid_request", async (_description, payload) => {
    const repository = repositoryDouble();
    app = buildApp({ revenueShareDistribution: deps({ repository }) });

    const response = await app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}/submission`,
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("rejects a malformed distribution ID in the path with 400 invalid_request", async () => {
    const repository = repositoryDouble();
    app = buildApp({ revenueShareDistribution: deps({ repository }) });

    const response = await app.inject({
      method: "POST",
      url: "/revenue-share-distributions/not-an-id/submission",
      payload: submissionBody
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it.each([
    ["an altered envelope", { code: "intent_mismatch", reason: "recipients" } as const],
    ["a foreign signature", { code: "invalid_signature", reason: "signature" } as const],
    ["an expired envelope", { code: "expired", reason: "timebounds" } as const],
    ["a fee-bump envelope", { code: "fee_bump", reason: "envelope" } as const],
    ["a malformed envelope", { code: "malformed_xdr", reason: "envelope" } as const],
    ["an unsupported operation", { code: "unsupported_operation", reason: "operation_type" } as const]
  ])("returns 422 xdr_rejected for %s without leaking the port's reason", async (_description, error) => {
    const repository = repositoryDouble();
    app = buildApp({
      revenueShareDistribution: deps({
        xdr: xdrDouble({ verify: { ok: false, error } }),
        repository
      })
    });

    const response = await app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}/submission`,
      payload: submissionBody
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ code: "xdr_rejected" });
    expect(response.body).not.toContain(error.reason);
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it.each([
    [
      "an idempotency conflict",
      { code: "idempotency_conflict" } as const,
      409,
      { code: "idempotency_conflict" }
    ],
    ["an unavailable store", { code: "unavailable" } as const, 503, { code: "unavailable" }],
    ["a missing record", { code: "not_found" } as const, 503, { code: "unavailable" }]
  ])("maps %s to its status", async (_description, error, status, body) => {
    app = buildApp({
      revenueShareDistribution: deps({ repository: repositoryDouble({ submit: { ok: false, error } }) })
    });

    const response = await app.inject({
      method: "POST",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}/submission`,
      payload: submissionBody
    });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(body);
  });
});

describe("GET /revenue-share-distributions/:distributionId", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns 200 with the persisted distribution and an explorer URL", async () => {
    app = buildApp({ revenueShareDistribution: deps() });

    const response = await app.inject({
      method: "GET",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ distribution: wireSnapshot });
    expect(typeof response.json().distribution.recipients[0].amountStroops).toBe("string");
  });

  it("looks the distribution up by the path ID", async () => {
    const repository = repositoryDouble();
    app = buildApp({ revenueShareDistribution: deps({ repository }) });

    await app.inject({ method: "GET", url: `/revenue-share-distributions/${DISTRIBUTION_ID}` });

    expect(repository.findById).toHaveBeenCalledOnce();
    expect(repository.findById).toHaveBeenCalledWith(DISTRIBUTION_ID);
  });

  it.each([
    [
      "an unknown distribution",
      { ok: false, error: { code: "not_found" } } as const,
      404,
      { code: "not_found" }
    ],
    [
      "an unavailable store",
      { ok: false, error: { code: "unavailable" } } as const,
      503,
      { code: "unavailable" }
    ]
  ])("maps %s to its status", async (_description, findById, status, body) => {
    app = buildApp({
      revenueShareDistribution: deps({ repository: repositoryDouble({ findById }) })
    });

    const response = await app.inject({
      method: "GET",
      url: `/revenue-share-distributions/${DISTRIBUTION_ID}`
    });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(body);
  });

  it("rejects a malformed distribution ID with 400 invalid_request", async () => {
    const repository = repositoryDouble();
    app = buildApp({ revenueShareDistribution: deps({ repository }) });

    const response = await app.inject({
      method: "GET",
      url: "/revenue-share-distributions/not-an-id"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(repository.findById).not.toHaveBeenCalled();
  });
});

describe("revenue-share distribution route registration", () => {
  it("is absent when the dependency group is not supplied", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/revenue-share-distributions",
      payload: prepareBody
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
