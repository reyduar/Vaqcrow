import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { parseCorrelationId } from "@vaqcrow/contracts";
import type { CorrelationId } from "@vaqcrow/contracts";
import type {
  FundingIntentRecord,
  FundingIntentRepositoryError,
  FundingIntentRepositoryPort,
  FundingIntentRepositoryResult,
  FundingIntentState,
  FundingIntentSubmission,
  FundingIntentSubmissionOutcome
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
 * #24 can persist exactly one state (acceptance criterion 3, D3). The table
 * CHECK enforces the same fact, so this constant and the constraint cannot
 * drift apart silently.
 */
const SUBMITTED_STATE: FundingIntentState = "submitted";

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
    // #24's vocabulary is exactly one state; a row holding anything else means
    // the shape changed underneath this adapter (#25 widens it deliberately).
    if (value !== SUBMITTED_STATE) {
      throw new Error("Unexpected funding intent state");
    }

    return SUBMITTED_STATE;
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
