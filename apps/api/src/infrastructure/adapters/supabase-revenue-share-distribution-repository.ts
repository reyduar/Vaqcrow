import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  campaignIdSchema,
  parseApplicationId,
  parseCorrelationId,
  parseRevenueShareDistributionId,
  parseRevenueShareDistributionState,
  parseRevenueShareDistributionTerms,
  parseStellarFailureReason
} from "@vaqcrow/contracts";
import type { CorrelationId } from "@vaqcrow/contracts";
import type {
  RevenueShareDistributionConfirmation,
  RevenueShareDistributionRecord,
  RevenueShareDistributionRepositoryError,
  RevenueShareDistributionRepositoryPort,
  RevenueShareDistributionRepositoryResult,
  RevenueShareDistributionState,
  RevenueShareDistributionSubmission,
  RevenueShareDistributionSubmissionOutcome,
  RevenueShareDistributionTransition
} from "../../application/ports/revenue-share-distribution-repository-port.js";

const PARENT_TABLE = "revenue_share_distribution";
const RECIPIENT_TABLE = "revenue_share_distribution_recipient";

/**
 * The one embed every read uses: the parent row plus its immutable child rows in
 * a single round trip. Recipients are decoded in `position` order regardless of
 * the order PostgREST happens to return them in.
 */
const SELECT_WITH_RECIPIENTS = `*, ${RECIPIENT_TABLE}(*)`;

/**
 * The only Postgres error this adapter interprets. A `23505` on insert cannot
 * say *which* unique constraint lost the race — `distribution_id` (primary key)
 * or `transaction_hash` (unique) — so it is disambiguated with a follow-up read.
 * Every other code maps to `unavailable`.
 */
const POSTGRES_UNIQUE_VIOLATION = "23505";

/** The partial unique index that allows one non-failed distribution per campaign and period. */
const PERIOD_UNIQUE_INDEX = "revenue_share_distribution_campaign_period_key";

const FAILED_STATE: RevenueShareDistributionState = "failed";

/**
 * A verified submission can only ever produce this state, so the insert pins it.
 * Every other state is reached by a transition, never by a write.
 */
const SUBMITTED_STATE: RevenueShareDistributionState = "submitted";

/** An ISO-8601 timestamp with an explicit offset, as every stored time crosses this boundary. */
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class SupabaseRevenueShareDistributionRepository
  implements RevenueShareDistributionRepositoryPort
{
  constructor(private readonly client: SupabaseClient) {}

  async submit(input: {
    record: RevenueShareDistributionSubmission;
    correlationId: CorrelationId;
  }): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionSubmissionOutcome>> {
    const { record, correlationId } = input;

    try {
      // The recipient rows ride along in the parent insert: PostgREST commits
      // one POST (and the nested foreign-key writes it embeds) in a single
      // transaction, so the parent is never left standing without the money
      // facts it distributes.
      const { data, error } = await this.client
        .from(PARENT_TABLE)
        .insert(this.toInsertRow(record, correlationId))
        .select(SELECT_WITH_RECIPIENTS)
        .single();

      if (error) {
        if (error.code === POSTGRES_UNIQUE_VIOLATION) {
          return this.resolveDuplicateSubmission(
            record.distributionId,
            record.transactionHash,
            this.violatesPeriodIndex(error)
          );
        }

        return {
          ok: false,
          error: this.toRepositoryError(error, correlationId, record.distributionId)
        };
      }

      return { ok: true, value: { record: this.toRecord(data), applied: true } };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findById(
    distributionId: string
  ): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionRecord>> {
    try {
      const { data, error } = await this.client
        .from(PARENT_TABLE)
        .select(SELECT_WITH_RECIPIENTS)
        .eq("distribution_id", distributionId)
        .maybeSingle();

      if (error) {
        // findById has no CorrelationId in hand; log the lookup subject instead.
        return { ok: false, error: this.toRepositoryError(error, undefined, distributionId) };
      }

      if (!data) {
        return { ok: false, error: { code: "not_found" } };
      }

      return { ok: true, value: this.toRecord(data) };
    } catch {
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  async findActiveByCampaignPeriod(input: {
    campaignId: string;
    period: string;
  }): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionRecord>> {
    try {
      const { data, error } = await this.client
        .from(PARENT_TABLE)
        .select(SELECT_WITH_RECIPIENTS)
        .eq("campaign_id", input.campaignId)
        .eq("period", input.period)
        .neq("state", FAILED_STATE)
        .maybeSingle();

      if (error) {
        return { ok: false, error: this.toRepositoryError(error, undefined, undefined) };
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
    distributionId: string;
    attempts: number;
    nextAttemptAt: string;
    correlationId: CorrelationId;
  }): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionTransition>> {
    return this.transition({
      distributionId: input.distributionId,
      // No `state` key: an inconclusive attempt leaves the distribution
      // `submitted` and only moves the schedule forward, which is what makes the
      // next run a resumption.
      update: {
        confirmation_attempts: input.attempts,
        next_attempt_at: input.nextAttemptAt
      },
      correlationId: input.correlationId
    });
  }

  async recordConfirmation(input: {
    distributionId: string;
    confirmation: RevenueShareDistributionConfirmation;
    correlationId: CorrelationId;
  }): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionTransition>> {
    const { confirmation } = input;

    // The union is exhaustive, so a terminal state can never be written without
    // the evidence it claims: `confirmed` always carries its ledger, `failed`
    // always carries its reason. The table's CHECKs pin the same invariant, so
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
      distributionId: input.distributionId,
      update,
      correlationId: input.correlationId
    });
  }

  async findPending(input: {
    now: string;
    limit: number;
  }): Promise<RevenueShareDistributionRepositoryResult<readonly RevenueShareDistributionRecord[]>> {
    try {
      const { data, error } = await this.client
        .from(PARENT_TABLE)
        .select(SELECT_WITH_RECIPIENTS)
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
   * `WHERE distribution_id = $1 AND state = 'submitted'` is what makes a
   * replayed confirmation a non-application instead of a double-apply, and the
   * reason this is not an upsert. A zero-row match is ambiguous between "already
   * terminal" and "no such distribution", so one follow-up read tells the two
   * apart, exactly as `resolveDuplicateSubmission` disambiguates a lost insert
   * race.
   */
  private async transition(input: {
    distributionId: string;
    update: Record<string, unknown>;
    correlationId: CorrelationId;
  }): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionTransition>> {
    const { distributionId, update, correlationId } = input;

    try {
      const { data, error } = await this.client
        .from(PARENT_TABLE)
        .update({ ...update, last_correlation_id: correlationId })
        .eq("distribution_id", distributionId)
        .eq("state", SUBMITTED_STATE)
        .select(SELECT_WITH_RECIPIENTS)
        .maybeSingle();

      if (error) {
        return { ok: false, error: this.toRepositoryError(error, correlationId, distributionId) };
      }

      if (data) {
        return { ok: true, value: { record: this.toRecord(data), applied: true } };
      }

      const existing = await this.findById(distributionId);

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
   * `distribution_id` is enough to tell the three cases apart, and the read is
   * sound even under concurrency: Postgres makes a duplicate-key insert wait
   * until the conflicting transaction resolves, so whichever row won is already
   * committed and visible to this SELECT.
   *
   *  - row found, same hash  → exact replay: return the original record, `applied: false`
   *  - row found, other hash → same distribution id re-used with a different payload
   *  - row missing           → the hash is held by a *different* distribution id
   *
   * The last two are both `idempotency_conflict`: a different payload under the
   * same key, or the same signed transaction distributing twice. Neither is a
   * replay and neither may be applied.
   */
  private async resolveDuplicateSubmission(
    distributionId: string,
    transactionHash: string,
    periodIndexViolated: boolean
  ): Promise<RevenueShareDistributionRepositoryResult<RevenueShareDistributionSubmissionOutcome>> {
    const existing = await this.findById(distributionId);

    if (!existing.ok) {
      if (existing.error.code === "not_found") {
        // No row under this id, so the violation came from another key: the
        // period index means the campaign's period is already distributed.
        return {
          ok: false,
          error: { code: periodIndexViolated ? "already_distributed" : "idempotency_conflict" }
        };
      }

      return existing;
    }

    if (existing.value.transactionHash === transactionHash) {
      return { ok: true, value: { record: existing.value, applied: false } };
    }

    return { ok: false, error: { code: "idempotency_conflict" } };
  }

  /**
   * Classifies a unique violation by the index it names. The Postgres text is
   * read here only to choose a typed code and is never returned or logged.
   */
  private violatesPeriodIndex(error: PostgrestError): boolean {
    return `${error.message} ${error.details}`.includes(PERIOD_UNIQUE_INDEX);
  }

  private toInsertRow(
    record: RevenueShareDistributionSubmission,
    correlationId: CorrelationId
  ): Record<string, unknown> {
    return {
      distribution_id: record.distributionId,
      state: SUBMITTED_STATE,
      network: record.network,
      network_passphrase: record.networkPassphrase,
      source_account_id: record.sourceAccountId,
      source_sequence: record.sourceSequence,
      memo: record.memo ?? null,
      expires_at: record.expiresAt,
      signed_xdr: record.signedXdr,
      transaction_hash: record.transactionHash,
      application_id: record.applicationId ?? null,
      campaign_id: record.campaignId ?? null,
      period: record.period ?? null,
      last_correlation_id: correlationId,
      // PostgREST casts a numeric JSON string to bigint. A JS bigint is not
      // JSON-serializable and a JS number would silently lose precision above
      // 2^53, so the lossless decimal string is the only safe carrier here.
      [RECIPIENT_TABLE]: record.recipients.map((recipient, position) => ({
        position,
        account_id: recipient.accountId,
        amount_stroops: recipient.amountStroops.toString()
      }))
    };
  }

  /**
   * Decodes a PostgREST row. Every field is validated rather than trusted, and
   * a malformed row throws inside the caller's `try`, which turns it into
   * `unavailable` — a corrupt read is never reported as a valid record.
   *
   * The terms (network identity, source, sequence, memo, expiry and the whole
   * recipient list) are re-parsed through the S1 contract parser, so the record
   * this adapter hands back cannot disagree with the shape the wire contract
   * promises. The recipient amounts are read as exact decimal strings before
   * parsing, so no value ever passes through a float.
   */
  private toRecord(row: unknown): RevenueShareDistributionRecord {
    const value = row as Record<string, unknown>;

    const terms = parseRevenueShareDistributionTerms({
      network: this.toText(value.network),
      networkPassphrase: this.toText(value.network_passphrase),
      sourceAccountId: this.toText(value.source_account_id),
      sourceSequence: this.toText(value.source_sequence),
      memo: this.toNullableText(value.memo),
      expiresAt: this.toTimestamp(value.expires_at),
      recipients: this.toRecipients(value[RECIPIENT_TABLE])
    });

    const state = parseRevenueShareDistributionState(value.state);

    const applicationId = value.application_id;
    const campaignId = value.campaign_id;
    const period = value.period;
    const confirmedAt = this.toOptionalTimestamp(value.confirmed_at);
    const ledgerSequence = this.toOptionalLedger(value.ledger_sequence);
    const failureReason = this.toOptionalFailureReason(value.failure_reason);

    // The equivalence form, mirroring the table's CHECKs: a terminal row must
    // carry the evidence of the state it claims, and no other state may carry
    // evidence for a state it is not in.
    if ((state === "confirmed") !== (confirmedAt !== undefined && ledgerSequence !== undefined)) {
      throw new Error("Incoherent confirmed evidence");
    }

    if ((state === "failed") !== (failureReason !== undefined)) {
      throw new Error("Incoherent failure evidence");
    }

    return {
      distributionId: parseRevenueShareDistributionId(value.distribution_id),
      network: terms.network,
      networkPassphrase: terms.networkPassphrase,
      sourceAccountId: terms.sourceAccountId,
      sourceSequence: terms.sourceSequence,
      ...(terms.memo === null ? {} : { memo: terms.memo }),
      expiresAt: terms.expiresAt,
      signedXdr: this.toText(value.signed_xdr),
      transactionHash: this.toText(value.transaction_hash),
      ...(applicationId === null || applicationId === undefined
        ? {}
        : { applicationId: parseApplicationId(applicationId) }),
      ...(campaignId === null || campaignId === undefined
        ? {}
        : { campaignId: campaignIdSchema.parse(campaignId) }),
      ...(period === null || period === undefined ? {} : { period: this.toText(period) }),
      recipients: terms.recipients,
      state,
      lastCorrelationId: parseCorrelationId(value.last_correlation_id),
      confirmationAttempts: this.toAttempts(value.confirmation_attempts),
      nextAttemptAt: this.toTimestamp(value.next_attempt_at),
      ...(confirmedAt === undefined ? {} : { confirmedAt }),
      ...(ledgerSequence === undefined ? {} : { ledgerSequence }),
      ...(failureReason === undefined ? {} : { failureReason }),
      createdAt: this.toTimestamp(value.created_at),
      updatedAt: this.toTimestamp(value.updated_at)
    };
  }

  /**
   * Decodes the embedded recipient rows in `position` order into the *wire*
   * shape the S1 parser expects: `amountStroops` is an exact decimal string and
   * the account is passed through unparsed, so `parseRevenueShareDistributionTerms`
   * performs the validation and the string-to-`bigint` conversion in one place.
   * A position is validated here because the contract's `recipients[]` carries
   * no position: it is a storage fact, not a wire fact.
   */
  private toRecipients(
    raw: unknown
  ): ReadonlyArray<{ readonly accountId: string; readonly amountStroops: string }> {
    if (!Array.isArray(raw)) {
      throw new Error("Malformed recipient collection");
    }

    return raw
      .map((entry) => this.toPositionedRecipient(entry))
      .sort((left, right) => left.position - right.position)
      .map((entry) => entry.recipient);
  }

  private toPositionedRecipient(entry: unknown): {
    readonly position: number;
    readonly recipient: { readonly accountId: string; readonly amountStroops: string };
  } {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error("Malformed recipient row");
    }

    const value = entry as Record<string, unknown>;

    return {
      position: this.toPosition(value.position),
      recipient: {
        accountId: this.toText(value.account_id),
        amountStroops: this.toStroopsString(value.amount_stroops)
      }
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
   * text, so an empty string is a value rather than a malformed row.
   */
  private toNullableText(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value !== "string") {
      throw new Error("Malformed text column");
    }

    return value;
  }

  private toTimestamp(value: unknown): string {
    if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) {
      throw new Error("Malformed timestamp column");
    }

    return value;
  }

  private toOptionalTimestamp(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    return this.toTimestamp(value);
  }

  private toOptionalLedger(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    return this.toBigint(value).toString();
  }

  private toOptionalFailureReason(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    // Parsed against the closed vocabulary: a reason outside it is a corrupt
    // read, not a value to pass through to a human.
    return parseStellarFailureReason(value);
  }

  /**
   * A non-negative safe integer. PostgREST renders `integer` as a JSON number,
   * so the position is checked rather than trusted: a negative or fractional
   * position is a malformed row, not an ordering to act on.
   */
  private toPosition(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      throw new Error("Malformed recipient position");
    }

    return value;
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

  /**
   * An exact stroop value as a decimal string. A JSON number above 2^53 has
   * already lost precision by the time the client parses it, so it is refused
   * rather than truncated; the positivity/exactness check belongs to the S1
   * `stroopsSchema` parser this string is handed to.
   */
  private toStroopsString(value: unknown): string {
    if (typeof value === "bigint") {
      return value.toString();
    }

    if (typeof value === "number") {
      if (!Number.isSafeInteger(value)) {
        throw new Error("Unsafe stroop result");
      }
      return String(value);
    }

    if (typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value)) {
      return value;
    }

    throw new Error("Malformed stroop result");
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
    distributionId?: string
  ): RevenueShareDistributionRepositoryError {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[SupabaseRevenueShareDistributionRepository] persistence error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      correlationId,
      distributionId
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
        // `idempotency_conflict`, `unavailable`), so none of them is surfaced as
        // a distinct code — only logged.
        return { code: "unavailable" };
    }
  }
}
