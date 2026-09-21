import type {
  CorrelationId,
  FundingIntentId,
  PrepareFundingIntentCommand,
  PreparedFundingIntent
} from "@vaqcrow/contracts";
import type { FundingIntentXdrPort } from "../ports/funding-intent-xdr-port.js";
import type { LedgerPort } from "../ports/ledger-port.js";

/**
 * Builds the unsigned envelope for a funding intent and returns it with the
 * terms it was built from. It persists nothing (`D2`): a funding intent only
 * becomes evidence once a signed transaction exists, so there is no
 * pre-submission row to write and no pre-submission state to invent.
 *
 * The account sequence is read from the ledger, never supplied by the caller:
 * a stale sequence produces an envelope the network rejects, and the caller has
 * no way to know the current one. An unfunded source account is an expected
 * Testnet state — the address is valid and simply holds nothing — so it is
 * reported as `account_not_found` rather than retried or treated as an outage.
 *
 * The intent's lifetime is set here, explicitly: the API owns how long an
 * instruction to move money stays signable, so it does not delegate that to an
 * adapter default.
 */

/** Long enough for a wallet prompt, short enough that a leaked envelope dies. */
const FUNDING_INTENT_VALIDITY_SECONDS = 15 * 60;

export interface PrepareFundingIntentDeps {
  readonly ledger: LedgerPort;
  readonly xdr: FundingIntentXdrPort;
  readonly network: { readonly network: string; readonly networkPassphrase: string };
  readonly generateIntentId: () => FundingIntentId;
}

export type PrepareFundingIntentError = {
  readonly code: "account_not_found" | "invalid_input" | "unavailable";
};

export type PrepareFundingIntentResult =
  | { readonly ok: true; readonly value: PreparedFundingIntent }
  | { readonly ok: false; readonly error: PrepareFundingIntentError };

export async function prepareFundingIntent(
  deps: PrepareFundingIntentDeps,
  input: { readonly command: PrepareFundingIntentCommand; readonly correlationId: CorrelationId }
): Promise<PrepareFundingIntentResult> {
  const command = input.command;

  const account = await deps.ledger.getAccount(command.sourceAccountId);

  if (!account.ok) {
    return account.error.code === "not_found"
      ? { ok: false, error: { code: "account_not_found" } }
      : { ok: false, error: { code: "unavailable" } };
  }

  const built = deps.xdr.build({
    networkPassphrase: deps.network.networkPassphrase,
    sourceAccountId: command.sourceAccountId,
    sourceSequence: account.value.sequence,
    destinationAccountId: command.destinationAccountId,
    amountStroops: command.amountStroops,
    maxTimeUnixSeconds: nowSeconds() + FUNDING_INTENT_VALIDITY_SECONDS,
    ...(command.memo === null ? {} : { memo: command.memo })
  });

  if (!built.ok) {
    // `invalid_input` is the port saying the caller handed it something it
    // cannot encode (an unbuildable account or sequence). Anything else on the
    // build path means the encoding layer could not run at all.
    return built.error.code === "invalid_input"
      ? { ok: false, error: { code: "invalid_input" } }
      : { ok: false, error: { code: "unavailable" } };
  }

  return {
    ok: true,
    value: {
      intentId: deps.generateIntentId(),
      xdr: built.value.xdr,
      network: deps.network.network,
      networkPassphrase: built.value.networkPassphrase,
      sourceAccountId: built.value.sourceAccountId,
      // The *effective* sequence: the builder increments the account sequence,
      // and that is what a later verification must compare the envelope against.
      sourceSequence: built.value.sourceSequence,
      destinationAccountId: built.value.destinationAccountId,
      amountStroops: built.value.amountStroops,
      memo: built.value.memo ?? null,
      expiresAt: built.value.expiresAt,
      // Declared metadata, echoed so the client can hand it back at submit. It
      // is not part of the terms: the envelope does not carry it, so no
      // verification could ever check it (`D4`).
      applicationId: command.applicationId
    }
  };
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
