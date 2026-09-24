import type { CampaignContributionRecord, CampaignState, ChainCampaignSnapshot } from "./campaign-repository-port.js";

/**
 * Reads the campaign vault contract's own state directly from the chain.
 *
 * This is the read half of the Soroban surface (`#247` U3); the write half —
 * building, verifying and submitting the signed invocations that change that
 * state — is `CampaignVaultInvocationPort`. Splitting them mirrors the
 * existing `LedgerPort`/`StellarTransactionPort` split for classic Horizon: a
 * read has no notion of retrying or of a signature, and folding it into the
 * write port would blur that.
 *
 * Nothing here imports the Stellar SDK — `api-application-stays-provider-free`
 * forbids it under `application/`. The adapter (`infrastructure/`) owns *how*
 * the contract is queried; this port only names *what* comes back.
 */

export type CampaignVaultChainErrorCode = "not_found" | "unavailable";

export interface CampaignVaultChainError {
  readonly code: CampaignVaultChainErrorCode;
}

export type CampaignVaultChainResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CampaignVaultChainError };

/**
 * The vault's on-chain lifecycle, in the contract's own vocabulary
 * (`contracts/campaign-vault/src/lib.rs::State`) — not the Supabase mirror's
 * `CampaignState` (`"open" | "settled" | "refundable"`). The two vocabularies
 * differ on purpose (see `packages/contracts/src/campaign.ts`'s own doc on
 * `campaignStateSchema`), so this port names the contract's own reading and
 * leaves the translation to {@link mapVaultStateToCampaignState}.
 */
export type VaultChainStateName = "funding" | "settled" | "refunding";

/** Everything the campaign status endpoint and the reconcile use case need from one chain read. */
export interface VaultChainState {
  readonly state: VaultChainStateName;
  readonly totalStroops: bigint;
  readonly goalStroops: bigint;
  readonly deadline: Date;
  readonly smeAccountId: string;
  readonly tokenContractId: string;
  /** When this snapshot was read — the chain has no timestamp of its own for "now". */
  readonly observedAt: Date;
}

export interface CampaignVaultChainPort {
  /** Reads the vault's full state in one round trip (state, total, goal, deadline, sme, token). */
  readCampaign(contractAddress: string): Promise<CampaignVaultChainResult<VaultChainState>>;

  /** Reads one investor's running contribution. Zero, not `not_found`, when the investor never contributed — the contract itself returns `0` rather than erroring (`contribution_of`). */
  readContribution(
    contractAddress: string,
    investorAccountId: string
  ): Promise<CampaignVaultChainResult<bigint>>;
}

/** The contract's `State` enum, translated to the mirror's own `CampaignState` vocabulary. */
export function mapVaultStateToCampaignState(state: VaultChainStateName): CampaignState {
  switch (state) {
    case "funding":
      return "open";
    case "settled":
      return "settled";
    case "refunding":
      return "refundable";
  }
}

/**
 * Builds the `ChainCampaignSnapshot` the reconcile use case (`CampaignRepositoryPort.reconcile`)
 * expects, from a chain read plus the per-investor contributions the caller
 * already gathered (typically via {@link CampaignVaultChainPort.readContribution}
 * for every known investor). Kept as a pure function, not a method on the
 * adapter, so the reconcile use case can depend on it without depending on the
 * Stellar SDK.
 */
export function toChainCampaignSnapshot(
  state: VaultChainState,
  contributions: readonly Omit<CampaignContributionRecord, "campaignId">[]
): ChainCampaignSnapshot {
  return {
    state: mapVaultStateToCampaignState(state.state),
    totalStroops: state.totalStroops,
    observedAt: state.observedAt.toISOString(),
    contributions
  };
}
