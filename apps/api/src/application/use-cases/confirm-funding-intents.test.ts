import { describe, expect, it, vi } from "vitest";
import { parseCorrelationId } from "@vaqcrow/contracts";
import type { FundingIntentRecord } from "../ports/funding-intent-repository-port.js";
import type {
  StellarSubmissionOutcome,
  StellarTransactionOutcome,
  StellarTransactionResult
} from "../ports/stellar-transaction-port.js";
import { confirmFundingIntents } from "./confirm-funding-intents.js";
import type { ConfirmationPolicy } from "./confirm-funding-intents.js";

const INTENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_INTENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const NOW = "2026-09-21T12:00:00.000Z";
const STILL_VALID = "2026-09-21T12:15:00.000Z";
const ALREADY_EXPIRED = "2026-09-21T11:59:59.000Z";
const SIGNED_XDR = "AAAAAgAAAABsynthetic-signed-envelope";
const TRANSACTION_HASH = "a".repeat(64);
const LEDGER_SEQUENCE = "1234567";
const LEDGER_CLOSED_AT = "2026-09-21T12:00:04.000Z";

const POLICY: ConfirmationPolicy = {
  batchSize: 5,
  initialBackoffMs: 1_000,
  maxBackoffMs: 8_000
};

function record(overrides: Partial<FundingIntentRecord> = {}): FundingIntentRecord {
  return {
    intentId: INTENT_ID,
    network: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
    sourceAccountId: "GCSYNTHETICSOURCEACCOUNTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    sourceSequence: "1099511627778",
    destinationAccountId: "GCSYNTHETICDESTINATIONACCOUNTBBBBBBBBBBBBBBBBBBBBB",
    amountStroops: 10_000_000n,
    expiresAt: STILL_VALID,
    signedXdr: SIGNED_XDR,
    transactionHash: TRANSACTION_HASH,
    state: "submitted",
    lastCorrelationId: CORRELATION_ID,
    confirmationAttempts: 0,
    nextAttemptAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

function depsFor(input: {
  pending?: readonly FundingIntentRecord[];
  pendingFails?: boolean;
  writeFails?: boolean;
  submit?: StellarTransactionResult<StellarSubmissionOutcome>;
  find?: StellarTransactionResult<StellarTransactionOutcome>;
} = {}) {
  const write = input.writeFails === true
    ? { ok: false, error: { code: "unavailable" } }
    : { ok: true, value: { record: record(), applied: true } };

  const findPending = vi
    .fn()
    .mockResolvedValue(
      input.pendingFails === true
        ? { ok: false, error: { code: "unavailable" } }
        : { ok: true, value: input.pending ?? [] }
    );
  const recordAttempt = vi.fn().mockResolvedValue(write);
  const recordConfirmation = vi.fn().mockResolvedValue(write);
  const submit = vi
    .fn()
    .mockResolvedValue(input.submit ?? { ok: true, value: { status: "accepted" } });
  const findTransaction = vi
    .fn()
    .mockResolvedValue(input.find ?? { ok: true, value: { status: "pending" } });

  return {
    repository: { findPending, recordAttempt, recordConfirmation },
    transaction: { submit, findTransaction },
    findPending,
    recordAttempt,
    recordConfirmation,
    submit,
    findTransaction
  };
}

function run(deps: ReturnType<typeof depsFor>, policy: ConfirmationPolicy = POLICY) {
  return confirmFundingIntents(deps, { now: NOW, correlationId: CORRELATION_ID, policy });
}

describe("confirmFundingIntents", () => {
  it("asks for the intents due at the given instant, bounded by the batch size", async () => {
    const deps = depsFor();

    await run(deps);

    expect(deps.findPending).toHaveBeenCalledWith({ now: NOW, limit: POLICY.batchSize });
  });

  it("surfaces a failed pending read instead of reporting that nothing was due", async () => {
    const deps = depsFor({ pendingFails: true });

    const result = await run(deps);

    // An empty tick and an unreachable database are different facts, and
    // collapsing them would hide an outage behind a quiet success.
    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("does nothing at all when no intent is due", async () => {
    const deps = depsFor();

    const result = await run(deps);

    expect(result).toEqual({ ok: true, value: [] });
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it("fails an intent whose envelope has expired, without touching the network", async () => {
    const deps = depsFor({ pending: [record({ expiresAt: ALREADY_EXPIRED })] });

    await run(deps);

    // The bound is the envelope's own maxTime (D3), so it is decided locally
    // rather than inferred from a provider's error code — and there is no point
    // submitting an envelope Stellar can no longer include.
    expect(deps.recordConfirmation).toHaveBeenCalledWith({
      intentId: INTENT_ID,
      confirmation: { outcome: "failed", reason: "expired" },
      correlationId: CORRELATION_ID
    });
    expect(deps.submit).not.toHaveBeenCalled();
    expect(deps.findTransaction).not.toHaveBeenCalled();
  });

  it("hands the envelope to the network and defers while it is in flight", async () => {
    const deps = depsFor({ pending: [record({ confirmationAttempts: 0 })] });

    const result = await run(deps);

    expect(deps.submit).toHaveBeenCalledWith(SIGNED_XDR);
    expect(deps.recordAttempt).toHaveBeenCalledWith({
      intentId: INTENT_ID,
      attempts: 1,
      nextAttemptAt: "2026-09-21T12:00:01.000Z",
      correlationId: CORRELATION_ID
    });
    expect(deps.recordConfirmation).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: [{ intentId: INTENT_ID, result: "deferred" }] });
  });

  it("reads the outcome on a later tick, after the envelope is already in flight", async () => {
    const deps = depsFor({
      pending: [record({ confirmationAttempts: 3 })],
      find: {
        ok: true,
        value: { status: "confirmed", ledgerSequence: LEDGER_SEQUENCE, confirmedAt: LEDGER_CLOSED_AT }
      }
    });

    const result = await run(deps);

    // It still re-offers the envelope: core dedupes it, and that is what keeps a
    // transaction alive in the queue instead of deriving the provider's own state
    // locally. What matters is that the lookup decided the outcome.
    expect(deps.submit).toHaveBeenCalledWith(SIGNED_XDR);
    expect(deps.findTransaction).toHaveBeenCalledWith(TRANSACTION_HASH);
    expect(deps.recordConfirmation).toHaveBeenCalledWith({
      intentId: INTENT_ID,
      confirmation: {
        outcome: "confirmed",
        ledgerSequence: LEDGER_SEQUENCE,
        confirmedAt: LEDGER_CLOSED_AT
      },
      correlationId: CORRELATION_ID
    });
    expect(deps.recordAttempt).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: [{ intentId: INTENT_ID, result: "confirmed" }] });
  });

  it("reports an unsuccessful transaction as a terminal failure", async () => {
    const deps = depsFor({
      pending: [record({ confirmationAttempts: 2 })],
      find: { ok: true, value: { status: "failed", reason: "insufficient_balance" } }
    });

    await run(deps);

    expect(deps.recordConfirmation).toHaveBeenCalledWith({
      intentId: INTENT_ID,
      confirmation: { outcome: "failed", reason: "insufficient_balance" },
      correlationId: CORRELATION_ID
    });
    expect(deps.recordAttempt).not.toHaveBeenCalled();
  });

  it.each(["bad_sequence", "insufficient_fee", "expired", "unsuccessful"] as const)(
    "reports a submission rejected for %s as a terminal failure",
    async (reason) => {
      const deps = depsFor({
        pending: [record()],
        submit: { ok: true, value: { status: "rejected", reason } }
      });

      await run(deps);

      expect(deps.recordConfirmation).toHaveBeenCalledWith({
        intentId: INTENT_ID,
        confirmation: { outcome: "failed", reason },
        correlationId: CORRELATION_ID
      });
      // A rejection is terminal, so there is nothing to look up.
      expect(deps.findTransaction).not.toHaveBeenCalled();
    }
  );

  it("fails an unusable envelope terminally rather than retrying it forever", async () => {
    const deps = depsFor({
      pending: [record()],
      submit: { ok: false, error: { code: "invalid_input" } }
    });

    await run(deps);

    expect(deps.recordConfirmation).toHaveBeenCalledWith({
      intentId: INTENT_ID,
      confirmation: { outcome: "failed", reason: "unsuccessful" },
      correlationId: CORRELATION_ID
    });
    expect(deps.recordAttempt).not.toHaveBeenCalled();
  });

  it("defers a transient submission failure without concluding anything", async () => {
    const deps = depsFor({
      pending: [record({ confirmationAttempts: 2 })],
      submit: { ok: false, error: { code: "unavailable" } }
    });

    const result = await run(deps);

    expect(deps.recordAttempt).toHaveBeenCalledWith({
      intentId: INTENT_ID,
      attempts: 3,
      nextAttemptAt: "2026-09-21T12:00:04.000Z",
      correlationId: CORRELATION_ID
    });
    expect(deps.recordConfirmation).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: [{ intentId: INTENT_ID, result: "unavailable" }] });
  });

  it("defers when the lookup itself is unavailable", async () => {
    const deps = depsFor({
      pending: [record({ confirmationAttempts: 1 })],
      find: { ok: false, error: { code: "unavailable" } }
    });

    const result = await run(deps);

    expect(deps.recordAttempt).toHaveBeenCalledWith({
      intentId: INTENT_ID,
      attempts: 2,
      nextAttemptAt: "2026-09-21T12:00:02.000Z",
      correlationId: CORRELATION_ID
    });
    expect(result).toEqual({ ok: true, value: [{ intentId: INTENT_ID, result: "unavailable" }] });
  });

  it("keeps the state where it is while the network has not decided", async () => {
    const deps = depsFor({
      pending: [record({ confirmationAttempts: 1 })],
      find: { ok: true, value: { status: "pending" } }
    });

    await run(deps);

    // Only the schedule moves. An attempt that observed nothing conclusive must
    // not move the state, because Vaqcrow does not know the outcome yet.
    expect(deps.recordAttempt).toHaveBeenCalledTimes(1);
    expect(deps.recordConfirmation).not.toHaveBeenCalled();
  });

  it.each([
    [1, "2026-09-21T12:00:01.000Z"],
    [2, "2026-09-21T12:00:02.000Z"],
    [3, "2026-09-21T12:00:04.000Z"],
    // The ceiling: the interval stops widening so a long-lived intent keeps being
    // checked without the load growing with the attempt count.
    [4, "2026-09-21T12:00:08.000Z"],
    [9, "2026-09-21T12:00:08.000Z"]
  ])("widens the interval after %i attempts to a %s next attempt", async (attempts, nextAttemptAt) => {
    const deps = depsFor({
      pending: [record({ confirmationAttempts: attempts - 1 })],
      find: { ok: true, value: { status: "pending" } }
    });

    await run(deps);

    expect(deps.recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ attempts, nextAttemptAt })
    );
  });

  it("keeps one intent's failure from abandoning the rest of the tick", async () => {
    const deps = depsFor({
      pending: [
        record({ intentId: INTENT_ID }),
        record({ intentId: OTHER_INTENT_ID, transactionHash: "b".repeat(64) })
      ],
      submit: { ok: false, error: { code: "unavailable" } }
    });

    const result = await run(deps);

    // Both intents are deferred on their own terms: a transient failure on one is
    // not a reason to stop looking at the other.
    expect(deps.recordAttempt).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected the tick to complete");
    expect(result.value).toHaveLength(2);
    expect(result.value.map((step) => step.intentId)).toEqual([INTENT_ID, OTHER_INTENT_ID]);
  });

  it("reports every intent it touched, so a caller can log a timeline", async () => {
    const deps = depsFor({
      pending: [
        record({ intentId: INTENT_ID }),
        record({ intentId: OTHER_INTENT_ID, expiresAt: ALREADY_EXPIRED })
      ],
      find: {
        ok: true,
        value: { status: "confirmed", ledgerSequence: LEDGER_SEQUENCE, confirmedAt: LEDGER_CLOSED_AT }
      }
    });

    const result = await run(deps);

    expect(result).toEqual({
      ok: true,
      value: [
        { intentId: INTENT_ID, result: "confirmed" },
        { intentId: OTHER_INTENT_ID, result: "failed" }
      ]
    });
  });

  it("carries one correlation id through the whole tick", async () => {
    const deps = depsFor({ pending: [record(), record({ intentId: OTHER_INTENT_ID })] });

    await run(deps);

    // A tick is one execution: DEMO.md §11 wants a visible correlation id per
    // execution, and every write it causes belongs to that same execution.
    for (const call of deps.recordAttempt.mock.calls) {
      expect(call[0].correlationId).toBe(CORRELATION_ID);
    }
  });

  it("reports a conclusion it could not record as unavailable, not as the conclusion", async () => {
    const deps = depsFor({
      pending: [record({ confirmationAttempts: 1 })],
      writeFails: true,
      find: {
        ok: true,
        value: { status: "confirmed", ledgerSequence: LEDGER_SEQUENCE, confirmedAt: LEDGER_CLOSED_AT }
      }
    });

    const result = await run(deps);

    // Horizon said confirmed, but the database never accepted it. Reporting
    // "confirmed" here would claim a settlement the system cannot show, and the
    // next step re-derives the same conclusion and retries the write anyway.
    expect(result).toEqual({ ok: true, value: [{ intentId: INTENT_ID, result: "unavailable" }] });
  });

  it("reports a deferral it could not record as unavailable too", async () => {
    const deps = depsFor({ pending: [record()], writeFails: true });

    const result = await run(deps);

    expect(result).toEqual({ ok: true, value: [{ intentId: INTENT_ID, result: "unavailable" }] });
  });
});
