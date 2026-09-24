import type { ContractOperation } from "@vaqcrow/contracts";

/**
 * Building, verifying, submitting and polling the signed Soroban invocations
 * that change the campaign vault's state.
 *
 * This mirrors `FundingIntentXdrPort` and `StellarTransactionPort` on
 * purpose: `prepare` is the invocation analogue of `FundingIntentXdrPort.build`,
 * `verify` of `FundingIntentXdrPort.verify`, and `submit`/`findResult` of
 * `StellarTransactionPort.submit`/`findTransaction`. The web never imports the
 * Stellar SDK (`web-never-imports-server-stellar-sdk`, D1 in
 * `odd/tasks/campaign-vault-web-journey.md`): it transports the opaque XDR
 * this port produces, gets it signed by Freighter, and hands the signed
 * envelope back — every other fact is re-derived here from the envelope
 * itself, never trusted from the caller.
 *
 * `verify` is synchronous, like `FundingIntentXdrPort.verify`: decoding and
 * re-checking a signed envelope is pure, offline work, and giving it an
 * `async` signature would only invite an adapter to sneak network I/O into a
 * step whose whole point is to be re-derivable from the envelope alone.
 */

export type ContractOperationName = ContractOperation;

export interface PrepareCampaignVaultInvocationInput {
  readonly contractAddress: string;
  readonly operation: ContractOperationName;
  /**
   * Whoever's signature the envelope needs. Equal to `investorAccountId` for
   * `contribute`/`withdraw` (the investor authorises their own money); for the
   * permissionless `refund` it may be any account, since the destination is
   * fixed by the contract regardless of who triggers it.
   */
  readonly sourceAccountId: string;
  readonly investorAccountId: string;
  /** Required for `contribute`; ignored (and must be omitted) for `withdraw`/`refund`. */
  readonly amountStroops?: bigint;
}

export interface PreparedCampaignVaultInvocation {
  /** The unsigned, already-simulated envelope — ready for Freighter to sign, nothing more. */
  readonly xdr: string;
  readonly networkPassphrase: string;
  readonly expiresAt: string;
}

export type CampaignVaultInvocationErrorCode = "invalid_input" | "unavailable";

export interface CampaignVaultInvocationError {
  readonly code: CampaignVaultInvocationErrorCode;
  readonly reason?: string;
}

export type CampaignVaultInvocationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CampaignVaultInvocationError };

/**
 * Why `verify` refused a signed envelope. Each name is the one fact that
 * failed to re-derive, mirroring `FundingIntentXdrErrorCode`'s own
 * one-reason-per-check shape.
 */
export type CampaignVaultInvocationRefusalCode =
  | "wrong_contract"
  | "wrong_function"
  | "wrong_arguments"
  | "wrong_source"
  | "bad_signature"
  | "expired"
  | "malformed";

export interface CampaignVaultInvocationRefusal {
  readonly code: CampaignVaultInvocationRefusalCode;
  readonly reason?: string;
}

export interface VerifyCampaignVaultInvocationInput {
  readonly signedXdr: string;
  readonly networkPassphrase: string;
  readonly contractAddress: string;
  readonly operation: ContractOperationName;
  readonly investorAccountId: string;
  readonly amountStroops?: bigint;
  /**
   * The expected signer, checked against the envelope's own source account.
   * Required for `contribute`/`withdraw`. Omitted for `refund`: the source is
   * whoever triggers it (permissionless), so only that any valid self-signature
   * is present is checked — not which account it belongs to.
   */
  readonly sourceAccountId?: string;
}

export interface VerifiedCampaignVaultInvocation {
  readonly transactionHash: string;
  /** The envelope's actual source account — the caller-supplied `sourceAccountId` when given, otherwise whichever account signed a `refund`. */
  readonly sourceAccountId: string;
  readonly operation: ContractOperationName;
  readonly investorAccountId: string;
  readonly amountStroops?: bigint;
}

export type CampaignVaultInvocationVerification =
  | { readonly ok: true; readonly value: VerifiedCampaignVaultInvocation }
  | { readonly ok: false; readonly refusal: CampaignVaultInvocationRefusal };

/**
 * `TRY_AGAIN_LATER` and a transport failure both surface as `ok: false,
 * error: { code: "unavailable" }` instead of a third status here — the same
 * split `StellarTransactionPort.submit` makes, and for the same reason: a
 * caller should retry `unavailable`, never treat it as a decided outcome.
 */
export type CampaignVaultSubmissionStatus = "accepted" | "rejected";

export interface CampaignVaultSubmissionOutcome {
  readonly hash: string;
  readonly status: CampaignVaultSubmissionStatus;
}

export type CampaignVaultInvocationOutcomeStatus = "pending" | "success" | "failed";

export interface CampaignVaultInvocationOutcome {
  readonly status: CampaignVaultInvocationOutcomeStatus;
}

export interface CampaignVaultInvocationPort {
  /** Builds and simulates exactly one contract call, ready to sign — never a batch, never pre-signed. */
  prepare(
    input: PrepareCampaignVaultInvocationInput
  ): Promise<CampaignVaultInvocationResult<PreparedCampaignVaultInvocation>>;

  /**
   * Re-derives every fact from a signed envelope: exactly one
   * `invokeHostFunction` operation, targeting the expected contract and
   * function, with the expected arguments, from the expected source (or, for
   * `refund`, any self-signed source), within unexpired time bounds, and
   * carrying a signature that verifies against that source's public key.
   */
  verify(input: VerifyCampaignVaultInvocationInput): CampaignVaultInvocationVerification;

  submit(signedXdr: string): Promise<CampaignVaultInvocationResult<CampaignVaultSubmissionOutcome>>;

  findResult(hash: string): Promise<CampaignVaultInvocationResult<CampaignVaultInvocationOutcome>>;
}
