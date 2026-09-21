import {
  parseCorrelationId,
  parseFundingIntentId,
  parsePrepareFundingIntentCommand,
  parsePreparedFundingIntent
} from "@vaqcrow/contracts";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type {
  BuiltFundingIntentXdr,
  FundingIntentXdrPort,
  FundingIntentXdrResult
} from "../ports/funding-intent-xdr-port.js";
import type { LedgerAccount, LedgerPort, LedgerResult } from "../ports/ledger-port.js";
import type { FundingIntentRepositoryPort } from "../ports/funding-intent-repository-port.js";
import { prepareFundingIntent } from "./prepare-funding-intent.js";

const INTENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const APPLICATION_ID = "87654321-4321-4abc-8def-123456789abc";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ACCOUNT_ID = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const DESTINATION_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const UNSIGNED_XDR = "AAAAAgAAAABfakeUnsignedEnvelope";
const EXPIRES_AT = "2026-09-21T12:00:00.000Z";
const NOW = new Date("2026-09-21T12:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);
/** Mirrors the use case's declared intent lifetime. */
const VALIDITY_SECONDS = 15 * 60;

const command = parsePrepareFundingIntentCommand({
  sourceAccountId: SOURCE_ACCOUNT_ID,
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: "10000000",
  memo: null,
  applicationId: null
});
const correlationId = parseCorrelationId(CORRELATION_ID);

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

const expectedPreparedIntent = parsePreparedFundingIntent({
  intentId: INTENT_ID,
  xdr: UNSIGNED_XDR,
  network: "testnet",
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567891",
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: "10000000",
  memo: null,
  expiresAt: EXPIRES_AT,
  applicationId: null
});

function ledgerReturning(result: LedgerResult<LedgerAccount>): LedgerPort {
  return { getAccount: vi.fn().mockResolvedValue(result) };
}

function xdrBuilding(
  result: FundingIntentXdrResult<BuiltFundingIntentXdr>
): FundingIntentXdrPort {
  return { build: vi.fn().mockReturnValue(result), verify: vi.fn() };
}

function repositoryDouble(): FundingIntentRepositoryPort {
  return { submit: vi.fn(), findById: vi.fn() };
}

function depsFor(input: {
  ledger: LedgerPort;
  xdr: FundingIntentXdrPort;
  repository: FundingIntentRepositoryPort;
}) {
  return {
    ledger: input.ledger,
    xdr: input.xdr,
    network: { network: "testnet", networkPassphrase: NETWORK_PASSPHRASE },
    generateIntentId: vi.fn(() => parseFundingIntentId(INTENT_ID)),
    // Present in scope on purpose: the use case must not touch it. `D2` keeps
    // the prepare step stateless, and this proves the statelessness rather than
    // assuming it from the shape of the dependencies.
    repository: input.repository
  };
}

describe("prepareFundingIntent", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the built envelope and persists nothing", async () => {
    const ledger = ledgerReturning({ ok: true, value: account });
    const xdr = xdrBuilding({ ok: true, value: built });
    const repository = repositoryDouble();

    const result = await prepareFundingIntent(depsFor({ ledger, xdr, repository }), {
      command,
      correlationId
    });

    expect(result).toEqual({ ok: true, value: expectedPreparedIntent });
    expect(ledger.getAccount).toHaveBeenCalledOnce();
    expect(ledger.getAccount).toHaveBeenCalledWith(SOURCE_ACCOUNT_ID);
    expect(xdr.build).toHaveBeenCalledOnce();
    expect(xdr.build).toHaveBeenCalledWith({
      networkPassphrase: NETWORK_PASSPHRASE,
      sourceAccountId: SOURCE_ACCOUNT_ID,
      sourceSequence: account.sequence,
      destinationAccountId: DESTINATION_ACCOUNT_ID,
      amountStroops: 10_000_000n,
      maxTimeUnixSeconds: NOW_SECONDS + VALIDITY_SECONDS
    });
    expect(repository.submit).not.toHaveBeenCalled();
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it("forwards a present memo to the builder", async () => {
    const withMemo = parsePrepareFundingIntentCommand({
      sourceAccountId: SOURCE_ACCOUNT_ID,
      destinationAccountId: DESTINATION_ACCOUNT_ID,
      amountStroops: "10000000",
      memo: "funding",
      applicationId: null
    });
    const ledger = ledgerReturning({ ok: true, value: account });
    const xdr = xdrBuilding({ ok: true, value: { ...built, memo: "funding" } });

    const result = await prepareFundingIntent(depsFor({ ledger, xdr, repository: repositoryDouble() }), {
      command: withMemo,
      correlationId
    });

    expect(xdr.build).toHaveBeenCalledWith(
      expect.objectContaining({ memo: "funding" })
    );
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ memo: "funding" })
    });
  });

  it("echoes a declared application link into the prepared intent", async () => {
    const withApplication = parsePrepareFundingIntentCommand({
      sourceAccountId: SOURCE_ACCOUNT_ID,
      destinationAccountId: DESTINATION_ACCOUNT_ID,
      amountStroops: "10000000",
      memo: null,
      applicationId: APPLICATION_ID
    });
    const ledger = ledgerReturning({ ok: true, value: account });
    const xdr = xdrBuilding({ ok: true, value: built });

    const result = await prepareFundingIntent(depsFor({ ledger, xdr, repository: repositoryDouble() }), {
      command: withApplication,
      correlationId
    });

    expect(result.ok && result.value.applicationId).toBe(APPLICATION_ID);
  });

  it("leaves the application link null when none was declared", async () => {
    const ledger = ledgerReturning({ ok: true, value: account });
    const xdr = xdrBuilding({ ok: true, value: built });

    const result = await prepareFundingIntent(depsFor({ ledger, xdr, repository: repositoryDouble() }), {
      command,
      correlationId
    });

    expect(result.ok && result.value.applicationId).toBeNull();
  });

  it("bounds the intent's lifetime from build time", async () => {
    const ledger = ledgerReturning({ ok: true, value: account });
    const xdr = xdrBuilding({ ok: true, value: built });

    await prepareFundingIntent(depsFor({ ledger, xdr, repository: repositoryDouble() }), {
      command,
      correlationId
    });

    const input = vi.mocked(xdr.build).mock.calls[0]?.[0];
    expect(input?.maxTimeUnixSeconds).toBe(NOW_SECONDS + VALIDITY_SECONDS);
    expect(input?.maxTimeUnixSeconds).toBeGreaterThan(NOW_SECONDS);
  });

  it.each([
    ["an unfunded source account", { ok: false, error: { code: "not_found" } } as const, "account_not_found"],
    ["an unavailable ledger", { ok: false, error: { code: "unavailable" } } as const, "unavailable"]
  ])("maps %s", async (_description, ledgerResult, expectedCode) => {
    const ledger = ledgerReturning(ledgerResult);
    const xdr = xdrBuilding({ ok: true, value: built });

    const result = await prepareFundingIntent(depsFor({ ledger, xdr, repository: repositoryDouble() }), {
      command,
      correlationId
    });

    expect(result).toEqual({ ok: false, error: { code: expectedCode } });
    expect(xdr.build).not.toHaveBeenCalled();
  });

  it.each([
    ["an invalid input", { ok: false, error: { code: "invalid_input" } } as const, "invalid_input"],
    ["a malformed envelope", { ok: false, error: { code: "malformed_xdr" } } as const, "unavailable"],
    ["an expired build window", { ok: false, error: { code: "expired" } } as const, "unavailable"]
  ])("maps a build failure of %s", async (_description, buildResult, expectedCode) => {
    const ledger = ledgerReturning({ ok: true, value: account });
    const xdr = xdrBuilding(buildResult);

    const result = await prepareFundingIntent(depsFor({ ledger, xdr, repository: repositoryDouble() }), {
      command,
      correlationId
    });

    expect(result).toEqual({ ok: false, error: { code: expectedCode } });
  });

  it("never builds an envelope for an account it could not read", async () => {
    const ledger = ledgerReturning({ ok: false, error: { code: "not_found" } });
    const xdr = xdrBuilding({ ok: true, value: built });

    await prepareFundingIntent(depsFor({ ledger, xdr, repository: repositoryDouble() }), {
      command,
      correlationId
    });

    expect(xdr.build).not.toHaveBeenCalled();
  });
});
