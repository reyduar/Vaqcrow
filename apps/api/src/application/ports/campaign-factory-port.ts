/**
 * Opening a campaign vault through the on-chain factory
 * (`contracts/campaign-factory/src/lib.rs`).
 *
 * `deploy` is the on-chain trace of the human approval (the factory's own
 * doc: "if there is no vault address, there is no campaign"), authorized by
 * the factory's `owner` — the platform's own account, signed with
 * `PlatformSigner` (D8) entirely inside the adapter. `predict` is the
 * read-only twin: deployed addresses are deterministic per `(deployer,
 * salt)`, so the platform (and the `open-campaign` use case's idempotency
 * check, D5) can learn a campaign's address before deploying it — or confirm
 * a retry would land on the same address it already deployed.
 *
 * Nothing here imports the Stellar SDK — `api-application-stays-provider-free`
 * forbids it under `application/`. The adapter owns *how* the factory is
 * simulated, prepared, signed and submitted; this port only names *what*
 * comes back.
 */

export type CampaignFactoryErrorCode = "invalid_input" | "unavailable";

export interface CampaignFactoryError {
  readonly code: CampaignFactoryErrorCode;
}

export type CampaignFactoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CampaignFactoryError };

export interface DeployCampaignVaultInput {
  /** 32 bytes, matching the contract's `BytesN<32>` — see `deriveSalt` in `open-campaign.ts` (D5). */
  readonly salt: Uint8Array;
  readonly smeAccountId: string;
  readonly tokenContractId: string;
  readonly goalStroops: bigint;
  readonly deadline: Date;
}

export interface DeployCampaignVaultOutcome {
  readonly contractAddress: string;
  readonly hash: string;
}

export interface CampaignFactoryPort {
  /** The address a vault with this salt *would* get, without deploying it. Never throws for "not deployed yet" — that is the expected answer, not an error. */
  predict(salt: Uint8Array): Promise<CampaignFactoryResult<string>>;

  /** Deploys one vault and returns its address, signed and submitted by the platform's own key. */
  deploy(input: DeployCampaignVaultInput): Promise<CampaignFactoryResult<DeployCampaignVaultOutcome>>;
}
