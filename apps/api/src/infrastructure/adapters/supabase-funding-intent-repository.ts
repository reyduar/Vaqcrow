import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { parseCorrelationId } from "@vaqcrow/contracts";
import type { CorrelationId } from "@vaqcrow/contracts";
import type {
  FundingIntentConfirmation,
  FundingIntentRecord,
  FundingIntentRepositoryError,
  FundingIntentRepositoryPort,
  FundingIntentRepositoryResult,
  FundingIntentState,
  FundingIntentSubmission,
  FundingIntentSubmissionOutcome,
  FundingIntentTransition
} from "../../application/ports/funding-intent-repository-port.js";

const TABLE = "funding_intent";

/**
 * The only Postgres error this adapter interprets. A `23505` on insert cannot
 * say *which* unique constraint lost the race — `intent_id` (primary key) or
 * `transaction_hash` (unique) — so it is disambiguated with a follow-up read.
 * Every other code maps to `unavailable`.
 */
const POSTGRES_UNIQUE_VIOLATION = "23505";

/**
 * A verified submission can only ever produce this state, so the insert pins it.
 * Every other state is reached by a transition, never by a write.
 */
const SUBMITTED_STATE: FundingIntentState = "submitted";

/** The states the table's CHECK admits, for decoding a row back. */
const PERSISTED_STATES: readonly FundingIntentState[] = ["submitted", "confirmed", "failed"];

export class SupabaseFundingIntentRepository implements FundingIntentRepositoryPort {
  constructor(private readonly client: SupabaseClient) {}

  async submit(input: {
    record: FundingIntentSubmission;
    correlationId: CorrelationId;
  }): Promise<FundingIntentRepositoryResult<FundingIntentSubmissionOutcome>> {
    const { record, correlationId } = input;

    try {
      const { data, error } = await this.client
        .from(TABLE)
        .insert(this.toInsertRow(record, correlationId))
        .select()
        .single();

      if (error) {
        if (error.code === POSTGRES_UNIQUE_VIOLATION) {
          return this.resolveDuplicateSubmission(record.intentId, record.transactionHash);
        }

        return { ok: false, error: this.toRepositoryError(error, correlationId, record.intentId) };
      }

      return { ok: true, value: { record: this.toRecord(data), applied: true } };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findById(intentId: string): Promise<FundingIntentRepositoryResult<FundingIntentRecord>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select()
        .eq("intent_id", intentId)
        .maybeSingle();

      if (error) {
        // findById has no CorrelationId in hand; log the lookup subject instead.
        return { ok: false, error: this.toRepositoryError(error, undefined, intentId) };
      }

      if (!data) {
        return { ok: false, error: { code: "not_found" } };
      }

      return { ok: true, value: this.toRecord(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async recordAttempt(input: {
    intentId: string;
    attempts: number;
    nextAttemptAt: string;
    correlationId: CorrelationId;
  }): Promise<FundingIntentRepositoryResult<FundingIntentTransition>> {
    return this.transition({
      intentId: input.intentId,
      // No `state` key: an inconclusive attempt leaves the intent `submitted`
      // and only moves the schedule forward, which is what makes the next run a
      // resumption (D3).
      update: {
        confirmation_attempts: input.attempts,
        next_attempt_at: input.nextAttemptAt
      },
      correlationId: input.correlationId
    });
  }

  async recordConfirmation(input: {
    intentId: string;
    confirmation: FundingIntentConfirmation;
    correlationId: CorrelationId;
  }): Promise<FundingIntentRepositoryResult<FundingIntentTransition>> {
    const { confirmation } = input;

    // The union is exhaustive, so a terminal state can never be written without
    // the evidence it claims: `confirmed` always carries its ledger, `failed`
    // always carries its reason. The table's CHECK pins the same invariant, so
    // the adapter and the database cannot drift apart silently.
    const update =
      confirmation.outcome === "confirmed"
        ? {
            state: "confirmed",
            confirmed_at: confirmation.confirmedAt,
            ledger_sequence: confirmation.ledgerSequence
          }
        : { state: "failed", failure_reason: confirmation.reason };

    return this.transition({
      intentId: input.intentId,
      update,
      correlationId: input.correlationId
    });
  }

  async findPending(input: {
    now: string;
    limit: number;
  }): Promise<FundingIntentRepositoryResult<readonly FundingIntentRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(TABLE)
        .select()
        // Only a row still awaiting an outcome is pending; a terminal row is
        // never polled again, and the partial index matches this predicate.
        .eq("state", SUBMITTED_STATE)
        .lte("next_attempt_at", input.now)
        .order("next_attempt_at", { ascending: true })
        .limit(input.limit);

      if (error) {
        return { ok: false, error: this.toRepositoryError(error, undefined, undefined) };
      }

      if (!Array.isArray(data)) {
        throw new Error("Malformed pending read");
      }

      // Strict on purpose: one malformed row makes the whole read `unavailable`
      // rather than being skipped. A skipped row would silently stop being
      // polled, which is indistinguishable from a confirmation that never came.
      return { ok: true, value: data.map((row) => this.toRecord(row)) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * Applies a state-machine transition, conditionally on the row still awaiting
   * an outcome.
   *
   * `WHERE intent_id = $1 AND state = 'submitted'` is what makes a replayed
   * confirmation a non-application instead of a double-apply — the same
   * conditional-update shape `recordHumanDecision` uses, and the reason this is
   * not an upsert. A zero-row match is ambiguous between "already terminal" and
   * "no such intent", so one follow-up read tells the two apart, exactly as
   * `resolveDuplicateSubmission` disambiguates a lost insert race.
   */
  private async transition(input: {
    intentId: string;
    update: Record<string, unknown>;
    correlationId: CorrelationId;
  }): Promise<FundingIntentRepositoryResult<FundingIntentTransition>> {
    const { intentId, update, correlationId } = input;

    try {
      const { data, error } = await this.client
        .from(TABLE)
        .update({ ...update, last_correlation_id: correlationId })
        .eq("intent_id", intentId)
        .eq("state", SUBMITTED_STATE)
        .select()
        .maybeSingle();

      if (error) {
        return { ok: false, error: this.toRepositoryError(error, correlationId, intentId) };
      }

      if (data) {
        return { ok: true, value: { record: this.toRecord(data), applied: true } };
      }

      const existing = await this.findById(intentId);

      if (!existing.ok) {
        return existing;
      }

      return { ok: true, value: { record: existing.value, applied: false } };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /**
   * The insert lost a race against an existing row. One follow-up read by
   * `intent_id` is enough to tell the three cases apart, and the read is sound
   * even under concurrency: Postgres makes a duplicate-key insert wait until the
   * conflicting transaction resolves, so whichever row won is already committed
   * and visible to this SELECT.
   *
   *  - row found, same hash  → exact replay: return the original record, `applied: false`
   *  - row found, other hash → same intent id re-used with a different payload
   *  - row missing           → the hash is held by a *different* intent id
   *
   * The last two are both `idempotency_conflict`: a different payload under the
   * same key, or the same signed transaction funding two intents. Neither is a
   * replay and neither may be applied.
   */
  private async resolveDuplicateSubmission(
    intentId: string,
    transactionHash: string
  ): Promise<FundingIntentRepositoryResult<FundingIntentSubmissionOutcome>> {
    const existing = await this.findById(intentId);

    if (!existing.ok) {
      if (existing.error.code === "not_found") {
        return { ok: false, error: { code: "idempotency_conflict" } };
      }

      return existing;
    }

    if (existing.value.transactionHash === transactionHash) {
      return { ok: true, value: { record: existing.value, applied: false } };
    }

    return { ok: false, error: { code: "idempotency_conflict" } };
  }

  private toInsertRow(
    record: FundingIntentSubmission,
    correlationId: CorrelationId
  ): Record<string, unknown> {
    return {
      intent_id: record.intentId,
      state: SUBMITTED_STATE,
      network: record.network,
      network_passphrase: record.networkPassphrase,
      source_account_id: record.sourceAccountId,
      source_sequence: record.sourceSequence,
      destination_account_id: record.destinationAccountId,
      // PostgREST casts a numeric JSON string to bigint. A JS bigint is not
      // JSON-serializable and a JS number would silently lose precision above
      // 2^53, so the lossless decimal string is the only safe carrier here.
      amount_stroops: record.amountStroops.toString(),
      memo: record.memo ?? null,
      expires_at: record.expiresAt,
      signed_xdr: record.signedXdr,
      transaction_hash: record.transactionHash,
      application_id: record.applicationId ?? null,
      last_correlation_id: correlationId
    };
  }

  /**
   * Decodes a PostgREST row. Every field is validated rather than trusted, and
   * a malformed row throws inside the caller's `try`, which turns it into
   * `unavailable` — a corrupt read is never reported as a valid record.
   *
   * The record is parsed by hand because @vaqcrow/contracts owns no funding
   * intent schema yet (WU3 adds it); this is the one place in this adapter that
   * would move into a shared parser once that lands.
   */
  private toRecord(row: unknown): FundingIntentRecord {
    const value = row as Record<string, unknown>;
    const memo = value.memo;
    const applicationId = value.application_id;
    const confirmedAt = value.confirmed_at;
    const ledgerSequence = value.ledger_sequence;
    const failureReason = value.failure_reason;

    return {
      intentId: this.toText(value.intent_id),
      state: this.toState(value.state),
      network: this.toText(value.network),
      networkPassphrase: this.toText(value.network_passphrase),
      sourceAccountId: this.toText(value.source_account_id),
      sourceSequence: this.toText(value.source_sequence),
      destinationAccountId: this.toText(value.destination_account_id),
      amountStroops: this.toBigint(value.amount_stroops),
      ...(memo === null || memo === undefined ? {} : { memo: this.toOptionalText(memo) }),
      expiresAt: this.toText(value.expires_at),
      signedXdr: this.toText(value.signed_xdr),
      transactionHash: this.toText(value.transaction_hash),
      ...(applicationId === null || applicationId === undefined
        ? {}
        : { applicationId: this.toText(applicationId) }),
      lastCorrelationId: parseCorrelationId(value.last_correlation_id),
      confirmationAttempts: this.toAttempts(value.confirmation_attempts),
      nextAttemptAt: this.toText(value.next_attempt_at),
      // Each optional field is absent rather than null when the column is null,
      // matching how `memo` and `applicationId` already cross this boundary. A
      // present-but-empty reason is malformed, not an absent one.
      ...(confirmedAt === null || confirmedAt === undefined
        ? {}
        : { confirmedAt: this.toText(confirmedAt) }),
      ...(ledgerSequence === null || ledgerSequence === undefined
        ? {}
        : { ledgerSequence: this.toBigint(ledgerSequence).toString() }),
      ...(failureReason === null || failureReason === undefined
        ? {}
        : { failureReason: this.toText(failureReason) }),
      createdAt: this.toText(value.created_at),
      updatedAt: this.toText(value.updated_at)
    };
  }

  private toText(value: unknown): string {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Malformed text column");
    }

    return value;
  }

  /**
   * A nullable text column that may legitimately be empty. A memo is caller
   * text, so an empty string is a value rather than a malformed row — unlike
   * every other text column here, which is an identifier that cannot be blank.
   * Without this, an intent stored with an empty memo could be written and then
   * never read back.
   */
  private toOptionalText(value: unknown): string {
    if (typeof value !== "string") {
      throw new Error("Malformed text column");
    }

    return value;
  }

  private toState(value: unknown): FundingIntentState {
    // A row holding anything outside the three demo states means the shape
    // changed underneath this adapter. That is a corrupt read, not a state to
    // pass through — `manual_review` and the pre-submission states of
    // product.md §8.1 are production roadmap, so they are refused here too.
    if (typeof value !== "string" || !PERSISTED_STATES.includes(value as FundingIntentState)) {
      throw new Error("Unexpected funding intent state");
    }

    return value as FundingIntentState;
  }

  /**
   * A non-negative safe integer. PostgREST renders `integer` as a JSON number,
   * so the count is checked rather than trusted: a negative or fractional
   * attempt count is a malformed row, not a schedule to act on.
   */
  private toAttempts(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      throw new Error("Malformed confirmation attempt count");
    }

    return value;
  }

  private toBigint(value: unknown): bigint {
    if (typeof value === "bigint") {
      return value;
    }

    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) {
        throw new Error("Unsafe bigint result");
      }
      return BigInt(value);
    }

    if (typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value)) {
      return BigInt(value);
    }

    throw new Error("Malformed bigint result");
  }

  private toRepositoryError(
    error: PostgrestError,
    correlationId?: CorrelationId,
    intentId?: string
  ): FundingIntentRepositoryError {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseFundingIntentRepository] persistence error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      correlationId,
      intentId
    });

    switch (error.code) {
      // 23505 is intercepted in `submit` before this runs; reaching it here (a
      // read, or a unique violation outside the insert path) has no replay
      // semantics to resolve, so it is not a modelled outcome.
      case POSTGRES_UNIQUE_VIOLATION:
      default:
        // 23514 (check violation), 23503 (foreign key), 42501 (permission
        // denied) and transport-level PostgREST codes all land here. The port's
        // error vocabulary is deliberately narrow (`not_found`,
        // `idempotency_conflict`, `unavailable`), so none of them is surfaced
        // as a distinct code — only logged.
        return { code: "unavailable" };
    }
  }
}
