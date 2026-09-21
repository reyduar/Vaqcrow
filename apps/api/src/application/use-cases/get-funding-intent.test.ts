import { parseCorrelationId, parseFundingIntentId, parseFundingIntentSnapshot } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type {
  FundingIntentRecord,
  FundingIntentRepositoryPort,
  FundingIntentRepositoryResult
} from "../ports/funding-intent-repository-port.js";
import { getFundingIntent } from "./get-funding-intent.js";

const INTENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ACCOUNT_ID = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const DESTINATION_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const SIGNED_XDR = "AAAAAgAAAABfakeSignedEnvelope";
const TRANSACTION_HASH = "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";
const EXPIRES_AT = "2026-09-21T12:00:00.000Z";

const intentId = parseFundingIntentId(INTENT_ID);
const correlationId = parseCorrelationId(CORRELATION_ID);

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
  lastCorrelationId: CORRELATION_ID,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
});

function repositoryReturning(
  result: FundingIntentRepositoryResult<FundingIntentRecord>
): {
  repository: FundingIntentRepositoryPort;
  findById: ReturnType<typeof vi.fn<FundingIntentRepositoryPort["findById"]>>;
} {
  const findById = vi.fn<FundingIntentRepositoryPort["findById"]>().mockResolvedValue(result);

  return { repository: { submit: vi.fn(), findById }, findById };
}

describe("getFundingIntent", () => {
  it("returns the persisted intent as a snapshot", async () => {
    const { repository } = repositoryReturning({ ok: true, value: record });

    const result = await getFundingIntent(repository, intentId);

    expect(result).toEqual({ ok: true, value: expectedSnapshot });
  });

  it("looks the intent up by the id it was given", async () => {
    const { repository, findById } = repositoryReturning({ ok: true, value: record });

    await getFundingIntent(repository, intentId);

    expect(findById).toHaveBeenCalledOnce();
    expect(findById).toHaveBeenCalledWith(INTENT_ID);
  });

  it("reports a persisted application link when there is one", async () => {
    const { repository } = repositoryReturning({
      ok: true,
      value: { ...record, applicationId: "87654321-4321-4abc-8def-123456789abc" }
    });

    const result = await getFundingIntent(repository, intentId);

    expect(result.ok && result.value.applicationId).toBe("87654321-4321-4abc-8def-123456789abc");
  });

  it("drops the signed envelope from the reported snapshot", async () => {
    const { repository } = repositoryReturning({ ok: true, value: record });

    const result = await getFundingIntent(repository, intentId);

    expect(result.ok && "signedXdr" in result.value).toBe(false);
  });

  it.each([
    ["an unknown intent", { ok: false, error: { code: "not_found" } } as const, "not_found"],
    ["an unavailable store", { ok: false, error: { code: "unavailable" } } as const, "unavailable"],
    [
      "an idempotency conflict",
      { ok: false, error: { code: "idempotency_conflict" } } as const,
      "unavailable"
    ]
  ])("maps %s", async (_description, repositoryResult, expectedCode) => {
    const { repository } = repositoryReturning(repositoryResult);

    const result = await getFundingIntent(repository, intentId);

    expect(result).toEqual({ ok: false, error: { code: expectedCode } });
  });

  it("maps a record the snapshot contract cannot express to unavailable", async () => {
    const { repository } = repositoryReturning({
      ok: true,
      value: { ...record, transactionHash: "" }
    });

    const result = await getFundingIntent(repository, intentId);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});
