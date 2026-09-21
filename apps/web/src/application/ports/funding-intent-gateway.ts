import type {
  FundingIntentId,
  FundingIntentSnapshot,
  PrepareFundingIntentCommand,
  PreparedFundingIntent,
  SubmitFundingIntentCommand
} from "@vaqcrow/contracts";

/**
 * Successful submit answer.
 *
 * `applied: false` is an exact replay of an already persisted intent, not a
 * failure: the API answers `202` for a first submission and `200` for a replay,
 * and both are successes. The distinction is carried here so the UI can say
 * which one happened instead of collapsing them.
 */
export interface SubmittedFundingIntent {
  readonly applied: boolean;
  readonly intent: FundingIntentSnapshot;
}

/**
 * Port for the funding-intent backend.
 *
 * Implementations return contract-validated data and throw on anything else;
 * HTTP failures surface as `HttpClientError` so `application/` can classify
 * them. The port is SDK-free and React-free: the unsigned XDR and the network
 * passphrase are opaque strings the web passes through untouched, so the web
 * never builds, decodes or verifies a transaction, and never owns a network
 * identity of its own (`D1`).
 */
export interface FundingIntentGateway {
  /** Builds the unsigned envelope. Stateless: nothing is persisted server-side. */
  prepare(command: PrepareFundingIntentCommand): Promise<PreparedFundingIntent>;
  /** Verifies and persists the signed envelope. `applied: false` is a replay. */
  submit(intentId: FundingIntentId, command: SubmitFundingIntentCommand): Promise<SubmittedFundingIntent>;
  /** Reads the persisted intent back. */
  get(intentId: FundingIntentId): Promise<FundingIntentSnapshot>;
}
