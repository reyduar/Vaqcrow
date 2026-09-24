import type {
  CampaignSnapshot,
  ContractInvocation,
  ContractInvocationSubmission,
  ContractInvocationTransactionStatus,
  OpenCampaignCommand,
  PrepareContractInvocationCommand,
  SubmitContractInvocationCommand
} from "@vaqcrow/contracts";

/**
 * Successful open-campaign answer.
 *
 * `applied: false` is an exact replay of an already-open vault, not a
 * failure: `POST /campaigns` answers `201` for a first open and `200` for a
 * replay (see `campaign.route.ts`), and both are successes. Carried the same
 * way `SubmittedFundingIntent.applied` is.
 */
export interface OpenedCampaign {
  readonly applied: boolean;
  readonly campaign: CampaignSnapshot;
}

/**
 * Port for the campaign-vault backend.
 *
 * Implementations return contract-validated data and throw on anything else;
 * HTTP failures surface as `HttpClientError` so `application/` and `state/`
 * can classify them. The port is SDK-free and React-free: every contract
 * invocation's XDR is an opaque string the web only transports and signs
 * with Freighter (`D1`) — it never builds, decodes or verifies a
 * transaction, and never imports the Stellar SDK.
 */
export interface CampaignGateway {
  /** Opens the vault for an approved application. `applied: false` is a replay of an already-open vault. */
  openCampaign(command: OpenCampaignCommand): Promise<OpenedCampaign>;
  /**
   * Reads the campaign's chain-observed state. `investorAccountId` also
   * asks for that investor's own contribution; omitted, the snapshot
   * carries no `investorContributionStroops`.
   */
  getCampaign(campaignId: string, investorAccountId?: string): Promise<CampaignSnapshot>;
  /** Builds and simulates one unsigned contract invocation, ready for Freighter to sign. */
  prepareInvocation(campaignId: string, command: PrepareContractInvocationCommand): Promise<ContractInvocation>;
  /** Verifies and submits the signed envelope. */
  submitInvocation(
    campaignId: string,
    command: SubmitContractInvocationCommand
  ): Promise<ContractInvocationSubmission>;
  /** Polls a submitted invocation's own transaction; `campaign` is present only once it succeeds. */
  getTransaction(campaignId: string, transactionHash: string): Promise<ContractInvocationTransactionStatus>;
}
