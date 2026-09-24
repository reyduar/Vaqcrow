import { z } from "zod";
import { applicationIdSchema } from "./application-id.js";
import { stroopsSchema } from "./funding-intent.js";

/**
 * Campaign vault wire contracts.
 *
 * The vault is a Soroban contract, not this mirror. `campaignStateSchema`
 * mirrors the contract's own on-chain `State` — "funding" while it still
 * accepts contributions, "settled" once the goal was reached and paid out,
 * "refunding" once the deadline passed under goal. That is a different
 * vocabulary on purpose from the Supabase mirror's own `state` column
 * (`"open" | "settled" | "refundable"`, see
 * `apps/api/src/application/ports/campaign-repository-port.ts`): the mirror
 * names its own bookkeeping, this schema names what the chain reports.
 *
 * Money crosses the wire the same way it does in `funding-intent.ts`: a
 * decimal-string stroop count, never a JSON number, because a JavaScript
 * number cannot represent a stroop count exactly above 2^53.
 */

/** A Stellar account (`G...`) public key — never key material. */
export const stellarAccountIdSchema = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, "must be a Stellar account address (G..., 56 characters)");

export type StellarAccountId = z.infer<typeof stellarAccountIdSchema>;

export function parseStellarAccountId(input: unknown): StellarAccountId {
  return stellarAccountIdSchema.parse(input);
}

/** A Stellar contract (`C...`) address, such as the campaign vault itself. */
export const stellarContractIdSchema = z
  .string()
  .regex(/^C[A-Z2-7]{55}$/, "must be a Stellar contract address (C..., 56 characters)");

export type StellarContractId = z.infer<typeof stellarContractIdSchema>;

export function parseStellarContractId(input: unknown): StellarContractId {
  return stellarContractIdSchema.parse(input);
}

/** The vault's on-chain lifecycle, as the campaign contract itself reports it. */
export const campaignStateSchema = z.enum(["funding", "settled", "refunding"]);

export type CampaignState = z.infer<typeof campaignStateSchema>;

export function parseCampaignState(input: unknown): CampaignState {
  return campaignStateSchema.parse(input);
}

/** In sync with the last chain read, or diverged and awaiting reconciliation (`D6`). */
export const reconciliationStatusSchema = z.enum(["in_sync", "diverged"]);

export type ReconciliationStatus = z.infer<typeof reconciliationStatusSchema>;

export function parseReconciliationStatus(input: unknown): ReconciliationStatus {
  return reconciliationStatusSchema.parse(input);
}

/**
 * A non-negative decimal integer string, parsed to `bigint`. Unlike
 * `stroopsSchema` (a funding amount, always positive), a campaign's running
 * total — and an investor's own contribution — may legitimately be zero
 * before the first contribution lands.
 */
export const nonNegativeStroopsSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)$/, "must be a non-negative decimal integer string")
  .transform((value) => BigInt(value));

/** Opens the vault: what the caller declares before the platform deploys it. */
export const openCampaignCommandSchema = z.strictObject({
  applicationId: applicationIdSchema,
  smeAccountId: stellarAccountIdSchema,
  goalStroops: stroopsSchema,
  deadline: z.iso.datetime({ offset: true })
});

export type OpenCampaignCommand = z.infer<typeof openCampaignCommandSchema>;

export function parseOpenCampaignCommand(input: unknown): OpenCampaignCommand {
  return openCampaignCommandSchema.parse(input);
}

/**
 * What the campaign status endpoint returns to the web: a chain-observed
 * snapshot already reconciled with the Supabase mirror (`D6`), never a
 * client declaration.
 */
export const campaignSnapshotSchema = z.strictObject({
  campaignId: z.uuidv4(),
  applicationId: applicationIdSchema,
  contractAddress: stellarContractIdSchema,
  network: z.string().trim().min(1),
  state: campaignStateSchema,
  goalStroops: stroopsSchema,
  totalStroops: nonNegativeStroopsSchema,
  deadline: z.iso.datetime({ offset: true }),
  smeAccountId: stellarAccountIdSchema,
  investorContributionStroops: nonNegativeStroopsSchema.nullable().optional(),
  reconciliationStatus: reconciliationStatusSchema,
  explorerUrl: z.url().optional()
});

export type CampaignSnapshot = z.infer<typeof campaignSnapshotSchema>;

export function parseCampaignSnapshot(input: unknown): CampaignSnapshot {
  return campaignSnapshotSchema.parse(input);
}

/** The three vault operations a signed invocation can carry out. */
export const contractOperationSchema = z.enum(["contribute", "withdraw", "refund"]);

export type ContractOperation = z.infer<typeof contractOperationSchema>;

export function parseContractOperation(input: unknown): ContractOperation {
  return contractOperationSchema.parse(input);
}

/**
 * What the prepare step returns: an unsigned, already-simulated invocation
 * the web only transports and signs with Freighter (`D1`) — it never
 * imports the Stellar SDK to build or inspect this XDR itself.
 */
export const contractInvocationSchema = z.strictObject({
  invocationId: z.uuidv4(),
  operation: contractOperationSchema,
  xdr: z.string().min(1),
  networkPassphrase: z.string().min(1),
  expiresAt: z.iso.datetime({ offset: true })
});

export type ContractInvocation = z.infer<typeof contractInvocationSchema>;

export function parseContractInvocation(input: unknown): ContractInvocation {
  return contractInvocationSchema.parse(input);
}

/** What the submit step accepts: the envelope Freighter signed, nothing else. */
export const submitContractInvocationCommandSchema = z.strictObject({
  signedXdr: z.string().min(1)
});

export type SubmitContractInvocationCommand = z.infer<typeof submitContractInvocationCommandSchema>;

export function parseSubmitContractInvocationCommand(input: unknown): SubmitContractInvocationCommand {
  return submitContractInvocationCommandSchema.parse(input);
}
