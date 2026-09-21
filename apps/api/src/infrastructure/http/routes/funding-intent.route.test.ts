import {
  correlationIdSchema,
  parseCorrelationId,
  parseFundingIntentId,
  parsePreparedFundingIntent
} from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  BuiltFundingIntentXdr,
  FundingIntentXdrPort,
  FundingIntentXdrResult,
  VerifiedFundingIntentXdr
} from "../../../application/ports/funding-intent-xdr-port.js";
import type { FundingIntentRecord } from "../../../application/ports/funding-intent-repository-port.js";
import type {
  LedgerAccount,
  LedgerPort,
  LedgerResult
} from "../../../application/ports/ledger-port.js";
import { buildApp } from "../build-app.js";
import type { FundingIntentRouteDependencies } from "./funding-intent.route.js";

const INTENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const APPLICATION_ID = "87654321-4321-4abc-8def-123456789abc";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ACCOUNT_ID = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const DESTINATION_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const UNSIGNED_XDR = "AAAAAgAAAABfakeUnsignedEnvelope";
const SIGNED_XDR = "AAAAAgAAAABfakeSignedEnvelope";
const TRANSACTION_HASH = "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";
const EXPIRES_AT = "2026-09-21T12:00:00.000Z";
const EXPLORER_BASE_URL = "https://stellar.expert/explorer/testnet";

const prepareBody = {
  sourceAccountId: SOURCE_ACCOUNT_ID,
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: "10000000",
  memo: null,
  applicationId: null
};

const terms = {
  network: "testnet",
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567891",
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: "10000000",
  memo: null,
  expiresAt: EXPIRES_AT
};

const submissionBody = { signedXdr: SIGNED_XDR, intent: terms, applicationId: null };

const account: LedgerAccount = {
  accountId: SOURCE_ACCOUNT_ID,
  sequence: "1234567890",
  nativeBalanceStroops: 50_000_000n
};

const built: BuiltFundingIntentXdr = {
  xdr: UNSIGNED_XDR,
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567891",
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: 10_000_000n,
  expiresAt: EXPIRES_AT
};

const verified: VerifiedFundingIntentXdr = {
  transactionHash: TRANSACTION_HASH,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: 10_000_000n,
  expiresAt: EXPIRES_AT
};

const preparedIntent = parsePreparedFundingIntent({
  intentId: INTENT_ID,
  xdr: UNSIGNED_XDR,
  ...terms,
  amountStroops: "10000000",
  applicationId: null
});

const snapshot: FundingIntentRecord = {
  intentId: INTENT_ID,
  network: "testnet",
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567891",
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: 10_000_000n,
  expiresAt: EXPIRES_AT,
  signedXdr: SIGNED_XDR,
  transactionHash: TRANSACTION_HASH,
  state: "submitted",
  lastCorrelationId: parseCorrelationId(CORRELATION_ID),
  // The confirmation schedule #25 persists. The route's wire snapshot is
  // deliberately unchanged by it — these are persistence facts, not reported
  // ones — but the record mirrors the row, so they are present.
  confirmationAttempts: 0,
  nextAttemptAt: "2026-09-21T12:00:10.000Z",
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
};

/** The wire form of a snapshot: money is a decimal string, never a JSON number. */
const wireSnapshot = {
  intentId: INTENT_ID,
  network: "testnet",
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567891",
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: "10000000",
  memo: null,
  expiresAt: EXPIRES_AT,
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
  build?: FundingIntentXdrResult<BuiltFundingIntentXdr>;
  verify?: FundingIntentXdrResult<VerifiedFundingIntentXdr>;
} = {}): FundingIntentXdrPort {
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
): FundingIntentRouteDependencies["repository"] {
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
    xdr?: FundingIntentXdrPort;
    repository?: FundingIntentRouteDependencies["repository"];
  } = {}
): FundingIntentRouteDependencies {
  return {
    ledger: overrides.ledger ?? ledgerReturning({ ok: true, value: account }),
    xdr: overrides.xdr ?? xdrDouble(),
    repository: overrides.repository ?? repositoryDouble(),
    network: { network: "testnet", networkPassphrase: NETWORK_PASSPHRASE },
    explorerBaseUrl: EXPLORER_BASE_URL,
    generateIntentId: vi.fn(() => parseFundingIntentId(INTENT_ID))
  };
}

describe("POST /funding-intents", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns 200 with the prepared intent, encoding stroops as a decimal string", async () => {
    app = buildApp({ fundingIntent: deps() });

    const response = await app.inject({ method: "POST", url: "/funding-intents", payload: prepareBody });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      intent: { ...preparedIntent, amountStroops: "10000000" }
    });
    expect(typeof response.json().intent.amountStroops).toBe("string");
  });

  const invalidPrepareBodies: ReadonlyArray<readonly [string, object | string]> = [
    ["a missing field", { ...prepareBody, memo: undefined }],
    ["an extra field", { ...prepareBody, unexpected: true }],
    ["a JSON number amount", { ...prepareBody, amountStroops: 10_000_000 }],
    ["a zero amount", { ...prepareBody, amountStroops: "0" }],
    ["a malformed application ID", { ...prepareBody, applicationId: "not-a-uuid" }],
    ["a source equal to the destination", { ...prepareBody, destinationAccountId: SOURCE_ACCOUNT_ID }],
    ["an array body", [1, 2, 3]]
  ];

  it.each(invalidPrepareBodies)("rejects %s with 400 invalid_request", async (_description, payload) => {
    app = buildApp({ fundingIntent: deps() });

    const response = await app.inject({ method: "POST", url: "/funding-intents", payload });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("does not reach the ledger for a rejected body", async () => {
    const ledger = ledgerReturning({ ok: true, value: account });
    app = buildApp({ fundingIntent: deps({ ledger }) });

    await app.inject({
      method: "POST",
      url: "/funding-intents",
      payload: { ...prepareBody, extra: true }
    });

    expect(ledger.getAccount).not.toHaveBeenCalled();
  });

  it("maps an unfunded source account to 404 account_not_found", async () => {
    app = buildApp({
      fundingIntent: deps({ ledger: ledgerReturning({ ok: false, error: { code: "not_found" } }) })
    });

    const response = await app.inject({ method: "POST", url: "/funding-intents", payload: prepareBody });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "account_not_found" });
  });

  it("maps an unavailable ledger to 503 unavailable", async () => {
    app = buildApp({
      fundingIntent: deps({ ledger: ledgerReturning({ ok: false, error: { code: "unavailable" } }) })
    });

    const response = await app.inject({ method: "POST", url: "/funding-intents", payload: prepareBody });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("maps an unbuildable envelope to 400 invalid_request", async () => {
    app = buildApp({
      fundingIntent: deps({ xdr: xdrDouble({ build: { ok: false, error: { code: "invalid_input" } } }) })
    });

    const response = await app.inject({ method: "POST", url: "/funding-intents", payload: prepareBody });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("sets the correlation ID header", async () => {
    app = buildApp({ fundingIntent: deps() });

    const response = await app.inject({ method: "POST", url: "/funding-intents", payload: prepareBody });

    expect(correlationIdSchema.safeParse(response.headers["x-correlation-id"]).success).toBe(true);
  });
});

describe("POST /funding-intents/:intentId/submission", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns 202 with applied=true for a first submission", async () => {
    app = buildApp({ fundingIntent: deps() });

    const response = await app.inject({
      method: "POST",
      url: `/funding-intents/${INTENT_ID}/submission`,
      payload: submissionBody
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ applied: true, intent: wireSnapshot });
  });

  it("returns 200 with applied=false for an exact replay", async () => {
    app = buildApp({
      fundingIntent: deps({
        repository: repositoryDouble({
          submit: { ok: true, value: { record: snapshot, applied: false } }
        })
      })
    });

    const response = await app.inject({
      method: "POST",
      url: `/funding-intents/${INTENT_ID}/submission`,
      payload: submissionBody
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ applied: false, intent: wireSnapshot });
  });

  it("forwards a declared application link to the repository", async () => {
    const repository = repositoryDouble({
      submit: { ok: true, value: { record: { ...snapshot, applicationId: APPLICATION_ID }, applied: true } }
    });
    app = buildApp({ fundingIntent: deps({ repository }) });

    const response = await app.inject({
      method: "POST",
      url: `/funding-intents/${INTENT_ID}/submission`,
      payload: { ...submissionBody, applicationId: APPLICATION_ID }
    });

    expect(vi.mocked(repository.submit).mock.calls[0]?.[0].record.applicationId).toBe(APPLICATION_ID);
    expect(response.statusCode).toBe(202);
    expect(response.json().intent.applicationId).toBe(APPLICATION_ID);
  });

  it("forwards the verified hash, the signed XDR and a generated correlation ID", async () => {
    const repository = repositoryDouble();
    app = buildApp({ fundingIntent: deps({ repository }) });

    const response = await app.inject({
      method: "POST",
      url: `/funding-intents/${INTENT_ID}/submission`,
      payload: submissionBody
    });

    const input = vi.mocked(repository.submit).mock.calls[0]?.[0];
    expect(input?.record.transactionHash).toBe(TRANSACTION_HASH);
    expect(input?.record.signedXdr).toBe(SIGNED_XDR);
    expect(correlationIdSchema.safeParse(input?.correlationId).success).toBe(true);
    expect(response.headers["x-correlation-id"]).toBe(input?.correlationId);
  });

  it("verifies the envelope against the declared terms", async () => {
    const xdr = xdrDouble();
    app = buildApp({ fundingIntent: deps({ xdr }) });

    await app.inject({
      method: "POST",
      url: `/funding-intents/${INTENT_ID}/submission`,
      payload: submissionBody
    });

    expect(xdr.verify).toHaveBeenCalledOnce();
    expect(xdr.verify).toHaveBeenCalledWith({
      xdr: SIGNED_XDR,
      networkPassphrase: NETWORK_PASSPHRASE,
      sourceAccountId: SOURCE_ACCOUNT_ID,
      sourceSequence: "1234567891",
      destinationAccountId: DESTINATION_ACCOUNT_ID,
      amountStroops: 10_000_000n,
      expiresAt: EXPIRES_AT
    });
  });

  const driftedBodies: ReadonlyArray<readonly [string, object | string]> = [
    ["a body missing signedXdr", { intent: terms, applicationId: null }],
    ["a body missing the application link", { signedXdr: SIGNED_XDR, intent: terms }],
    ["a body with an extra key", { ...submissionBody, extra: true }],
    ["an empty signed XDR", { ...submissionBody, signedXdr: "" }],
    ["a malformed application link", { ...submissionBody, applicationId: "not-a-uuid" }],
    ["an intent missing a term", { ...submissionBody, intent: { ...terms, memo: undefined } }],
    [
      "an intent carrying an application link",
      { ...submissionBody, intent: { ...terms, applicationId: null } }
    ],
    ["an intent with a non-integer amount", { ...submissionBody, intent: { ...terms, amountStroops: "1.5" } }]
  ];

  it.each(driftedBodies)("rejects %s with 400 invalid_request", async (_description, payload) => {
    const repository = repositoryDouble();
    app = buildApp({ fundingIntent: deps({ repository }) });

    const response = await app.inject({
      method: "POST",
      url: `/funding-intents/${INTENT_ID}/submission`,
      payload
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("rejects a malformed intent ID in the path with 400 invalid_request", async () => {
    const repository = repositoryDouble();
    app = buildApp({ fundingIntent: deps({ repository }) });

    const response = await app.inject({
      method: "POST",
      url: "/funding-intents/not-an-id/submission",
      payload: submissionBody
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it.each([
    ["an altered envelope", { code: "intent_mismatch", reason: "amount" } as const],
    ["a foreign signature", { code: "invalid_signature", reason: "signature" } as const],
    ["an expired envelope", { code: "expired", reason: "timebounds" } as const],
    ["a fee-bump envelope", { code: "fee_bump", reason: "envelope" } as const],
    ["a malformed envelope", { code: "malformed_xdr", reason: "envelope" } as const],
    ["an unsupported operation", { code: "unsupported_operation", reason: "operation_type" } as const]
  ])("returns 422 xdr_rejected for %s without leaking the port's reason", async (_description, error) => {
    const repository = repositoryDouble();
    app = buildApp({
      fundingIntent: deps({ xdr: xdrDouble({ verify: { ok: false, error } }), repository })
    });

    const response = await app.inject({
      method: "POST",
      url: `/funding-intents/${INTENT_ID}/submission`,
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
      fundingIntent: deps({ repository: repositoryDouble({ submit: { ok: false, error } }) })
    });

    const response = await app.inject({
      method: "POST",
      url: `/funding-intents/${INTENT_ID}/submission`,
      payload: submissionBody
    });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(body);
  });
});

describe("GET /funding-intents/:intentId", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns 200 with the persisted intent", async () => {
    app = buildApp({ fundingIntent: deps() });

    const response = await app.inject({ method: "GET", url: `/funding-intents/${INTENT_ID}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ intent: wireSnapshot });
    expect(typeof response.json().intent.amountStroops).toBe("string");
  });

  it("looks the intent up by the path ID", async () => {
    const repository = repositoryDouble();
    app = buildApp({ fundingIntent: deps({ repository }) });

    await app.inject({ method: "GET", url: `/funding-intents/${INTENT_ID}` });

    expect(repository.findById).toHaveBeenCalledOnce();
    expect(repository.findById).toHaveBeenCalledWith(INTENT_ID);
  });

  it.each([
    [
      "an unknown intent",
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
    app = buildApp({ fundingIntent: deps({ repository: repositoryDouble({ findById }) }) });

    const response = await app.inject({ method: "GET", url: `/funding-intents/${INTENT_ID}` });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(body);
  });

  it("rejects a malformed intent ID with 400 invalid_request", async () => {
    const repository = repositoryDouble();
    app = buildApp({ fundingIntent: deps({ repository }) });

    const response = await app.inject({ method: "GET", url: "/funding-intents/not-an-id" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(repository.findById).not.toHaveBeenCalled();
  });
});

describe("funding intent route registration", () => {
  it("is absent when the funding-intent dependency group is not supplied", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/funding-intents",
      payload: prepareBody
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
