import {
  parseCorrelationId,
  parseFundingIntentId,
  parseFundingIntentSnapshot,
  parseSubmitFundingIntentCommand
} from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  FundingIntentRecord,
  FundingIntentRepositoryPort,
  FundingIntentRepositoryResult,
  FundingIntentSubmission,
  FundingIntentSubmissionOutcome
} from "../ports/funding-intent-repository-port.js";
import type {
  FundingIntentXdrPort,
  FundingIntentXdrResult,
  VerifiedFundingIntentXdr
} from "../ports/funding-intent-xdr-port.js";
import { submitFundingIntent, type SubmitFundingIntentDeps } from "./submit-funding-intent.js";

const INTENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const APPLICATION_ID = "87654321-4321-4abc-8def-123456789abc";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ACCOUNT_ID = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const DESTINATION_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const SIGNED_XDR = "AAAAAgAAAABfakeSignedEnvelope";
const TRANSACTION_HASH = "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";
const EXPIRES_AT = "2026-09-21T12:00:00.000Z";
const EXPLORER_BASE_URL = "https://stellar.expert/explorer/testnet";

const intentId = parseFundingIntentId(INTENT_ID);
const correlationId = parseCorrelationId(CORRELATION_ID);

const command = parseSubmitFundingIntentCommand({
  signedXdr: SIGNED_XDR,
  intent: {
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASE,
    sourceAccountId: SOURCE_ACCOUNT_ID,
    sourceSequence: "1234567891",
    destinationAccountId: DESTINATION_ACCOUNT_ID,
    amountStroops: "10000000",
    memo: null,
    expiresAt: EXPIRES_AT
  },
  applicationId: null
});

const commandWithApplication = parseSubmitFundingIntentCommand({
  signedXdr: SIGNED_XDR,
  intent: {
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASE,
    sourceAccountId: SOURCE_ACCOUNT_ID,
    sourceSequence: "1234567891",
    destinationAccountId: DESTINATION_ACCOUNT_ID,
    amountStroops: "10000000",
    memo: null,
    expiresAt: EXPIRES_AT
  },
  applicationId: APPLICATION_ID
});

const verified: VerifiedFundingIntentXdr = {
  transactionHash: TRANSACTION_HASH,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: 10_000_000n,
  expiresAt: EXPIRES_AT
};

const record: FundingIntentRecord = {
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
  lastCorrelationId: correlationId,
  // The confirmation schedule #25 persists. A submission never reads it back,
  // but the record mirrors the row, so it is present.
  confirmationAttempts: 0,
  nextAttemptAt: "2026-09-21T12:00:10.000Z",
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
};

const expectedSnapshot = parseFundingIntentSnapshot({
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
});

function xdrVerifying(
  result: FundingIntentXdrResult<VerifiedFundingIntentXdr>
): FundingIntentXdrPort {
  return { build: vi.fn(), verify: vi.fn().mockReturnValue(result) };
}

function repositoryReturning(
  result: FundingIntentRepositoryResult<FundingIntentSubmissionOutcome>
): {
  repository: SubmitFundingIntentDeps["repository"];
  submit: ReturnType<typeof vi.fn<FundingIntentRepositoryPort["submit"]>>;
} {
  const submit = vi.fn<FundingIntentRepositoryPort["submit"]>().mockResolvedValue(result);

  // Only the write operation: the confirmation surface #25 adds belongs to the
  // poll, not to a submission.
  return { repository: { submit }, submit };
}

describe("submitFundingIntent", () => {
  it("verifies the envelope against the terms the command declares", async () => {
    const xdr = xdrVerifying({ ok: true, value: verified });
    const { repository } = repositoryReturning({
      ok: true,
      value: { record, applied: true }
    });

    await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

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

  it("passes the verified hash and the signed XDR to the repository", async () => {
    const xdr = xdrVerifying({ ok: true, value: verified });
    const { repository, submit } = repositoryReturning({
      ok: true,
      value: { record, applied: true }
    });

    await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

    expect(submit).toHaveBeenCalledOnce();
    const input = submit.mock.calls[0]?.[0];
    expect(input?.correlationId).toBe(CORRELATION_ID);
    expect(input?.record.transactionHash).toBe(TRANSACTION_HASH);
    expect(input?.record.signedXdr).toBe(SIGNED_XDR);
    expect(input?.record.intentId).toBe(INTENT_ID);
    expect(input?.record.amountStroops).toBe(10_000_000n);
  });

  it.each([true, false])("returns the snapshot with applied=%s", async (applied) => {
    const xdr = xdrVerifying({ ok: true, value: verified });
    const { repository } = repositoryReturning({
      ok: true,
      value: { record, applied }
    });

    const result = await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

    expect(result).toEqual({ ok: true, value: { intent: expectedSnapshot, applied } });
  });

  it("forwards a declared application link into the persisted record", async () => {
    const xdr = xdrVerifying({ ok: true, value: verified });
    const { repository, submit } = repositoryReturning({
      ok: true,
      value: { record, applied: true }
    });

    await submitFundingIntent(
      { xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL },
      { intentId, command: commandWithApplication, correlationId }
    );

    const input = submit.mock.calls[0]?.[0];
    expect(input?.record.applicationId).toBe(APPLICATION_ID);
    // Declared metadata, never a term: the envelope is verified against the
    // terms alone, so the link must not reach the XDR port.
    expect(vi.mocked(xdr.verify).mock.calls[0]?.[0]).not.toHaveProperty("applicationId");
  });

  it("does not invent an application link when none was declared", async () => {
    const xdr = xdrVerifying({ ok: true, value: verified });
    const { repository, submit } = repositoryReturning({
      ok: true,
      value: { record, applied: true }
    });

    await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

    const input = submit.mock.calls[0]?.[0];
    expect(input?.record).not.toHaveProperty("applicationId");
  });

  it("drops the signed envelope from the reported snapshot", async () => {
    const xdr = xdrVerifying({ ok: true, value: verified });
    const { repository } = repositoryReturning({ ok: true, value: { record, applied: true } });

    const result = await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

    expect(result.ok && "signedXdr" in result.value.intent).toBe(false);
  });

  it.each([
    ["a tampered envelope", { code: "intent_mismatch", reason: "amount" } as const, "amount"],
    ["an unsigned envelope", { code: "invalid_signature", reason: "missing" } as const, "missing"],
    ["an expired envelope", { code: "expired", reason: "timebounds" } as const, "timebounds"],
    ["a malformed envelope", { code: "malformed_xdr", reason: "envelope" } as const, "envelope"],
    ["a fee-bump envelope", { code: "fee_bump", reason: "envelope" } as const, "envelope"],
    [
      "an unsupported operation",
      { code: "unsupported_operation", reason: "operation_type" } as const,
      "operation_type"
    ]
  ])("maps %s to xdr_rejected carrying the port's reason", async (_description, error, reason) => {
    const xdr = xdrVerifying({ ok: false, error });
    const { repository, submit } = repositoryReturning({
      ok: true,
      value: { record, applied: true }
    });

    const result = await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

    expect(result).toEqual({ ok: false, error: { code: "xdr_rejected", reason } });
    expect(submit).not.toHaveBeenCalled();
  });

  it("falls back to the port's error code when it names no reason", async () => {
    const xdr = xdrVerifying({ ok: false, error: { code: "malformed_xdr" } });
    const { repository } = repositoryReturning({ ok: true, value: { record, applied: true } });

    const result = await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

    expect(result).toEqual({ ok: false, error: { code: "xdr_rejected", reason: "malformed_xdr" } });
  });

  it.each([
    ["an idempotency conflict", { code: "idempotency_conflict" } as const, "idempotency_conflict"],
    ["an unavailable store", { code: "unavailable" } as const, "unavailable"],
    ["a missing record", { code: "not_found" } as const, "unavailable"]
  ])("maps %s from the repository", async (_description, error, expectedCode) => {
    const xdr = xdrVerifying({ ok: true, value: verified });
    const { repository } = repositoryReturning({ ok: false, error });

    const result = await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

    expect(result).toEqual({ ok: false, error: { code: expectedCode } });
  });

  it("persists nothing when verification refuses the envelope", async () => {
    const xdr = xdrVerifying({ ok: false, error: { code: "intent_mismatch", reason: "source" } });
    const { repository, submit } = repositoryReturning({
      ok: true,
      value: { record, applied: true }
    });

    await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

    expect(submit).not.toHaveBeenCalled();
  });

  it("maps a record the snapshot contract cannot express to unavailable", async () => {
    const xdr = xdrVerifying({ ok: true, value: verified });
    const { repository } = repositoryReturning({
      ok: true,
      value: { record: { ...record, intentId: "not-a-uuid" }, applied: true }
    });

    const result = await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("keeps the submission payload free of any server-owned fact", async () => {
    const xdr = xdrVerifying({ ok: true, value: verified });
    const { repository, submit } = repositoryReturning({
      ok: true,
      value: { record, applied: true }
    });

    await submitFundingIntent({ xdr, repository, explorerBaseUrl: EXPLORER_BASE_URL }, { intentId, command, correlationId });

    const payload = submit.mock.calls[0]?.[0].record as FundingIntentSubmission;
    expect(payload).not.toHaveProperty("state");
    expect(payload).not.toHaveProperty("createdAt");
    expect(payload).not.toHaveProperty("updatedAt");
    expect(payload).not.toHaveProperty("lastCorrelationId");
  });
});
