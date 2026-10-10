import { z } from "zod";
import { applicationIdSchema } from "./application-id.js";
import { applicationReviewStateSchema, humanDecisionOutcomeSchema } from "./application-review.js";
import {
  campaignIdSchema,
  campaignStateSchema,
  reconciliationStatusSchema,
  stellarAccountIdSchema,
  stellarContractIdSchema
} from "./campaign.js";
import { revenueShareDistributionStateSchema } from "./revenue-share-distribution.js";
import { revenueShareDistributionIdSchema } from "./revenue-share-distribution-id.js";
import { periodSchema } from "./sme-evidence.js";
import { stellarFailureReasonSchema } from "./stellar-failure-reason.js";

/**
 * The ADMIN per-application Testnet evidence chain
 * (`GET /application-reviews/:applicationId/evidence`, Feature #438, WU2).
 *
 * One read-only aggregate the admin reaches from the PyMEs queue: the human
 * decision, the vault deployment, the vault itself, every confirmed
 * contribution, every distribution, and the reconciliation the API last
 * *stored* — read from the mirror without calling the chain.
 *
 * Explorer links are built by the API from its own explorer base and are `null`
 * when that base is undefined (the `local` network has no canonical explorer):
 * the web renders the link it is given and never decides which network a hash
 * belongs to. `null` is always the honest "sin dato" — a vault adopted from an
 * earlier attempt has no deploy hash, an application without a decision has no
 * decision — and never a fabricated value.
 *
 * Money crosses the wire as a decimal stroop string, never a JSON number: a
 * JavaScript number cannot carry a stroop count exactly above 2^53.
 */

/** A Stellar transaction hash: 32 bytes as lowercase hex. */
const transactionHashSchema = z.string().regex(/^[0-9a-f]{64}$/, "must be a 64-character lowercase hex hash");

/** A non-negative decimal integer stroop count, kept as a string end to end. */
const stroopAmountSchema = z.string().regex(/^(?:0|[1-9]\d*)$/, "must be a non-negative decimal integer string");

const timestampSchema = z.iso.datetime({ offset: true });

/** The latest human decision, without its internal ids or correlation id. */
export const adminEvidenceDecisionSchema = z.strictObject({
  actor: z.string().trim().min(1),
  outcome: humanDecisionOutcomeSchema,
  reason: z.string().trim().min(1),
  approvedLimitArs: z.int().positive().nullable(),
  decidedAt: timestampSchema
});

export type AdminEvidenceDecision = z.infer<typeof adminEvidenceDecisionSchema>;

/** The vault-deployment lifecycle row (#410/T5b); `campaignId` is set once confirmed. */
export const adminEvidenceDeploymentStateSchema = z.enum(["pending", "deploying", "confirmed", "failed"]);

export type AdminEvidenceDeploymentState = z.infer<typeof adminEvidenceDeploymentStateSchema>;

export const adminEvidenceDeploymentSchema = z.strictObject({
  state: adminEvidenceDeploymentStateSchema,
  campaignId: campaignIdSchema.nullable()
});

export type AdminEvidenceDeployment = z.infer<typeof adminEvidenceDeploymentSchema>;

/**
 * The campaign vault as mirrored. `deployTransactionHash` is `null` for a vault
 * mirrored before the hash was persisted or adopted from an earlier attempt; a
 * deploy link without that hash is unrepresentable.
 */
export const adminEvidenceVaultSchema = z
  .strictObject({
    campaignId: campaignIdSchema,
    contractAddress: stellarContractIdSchema,
    vaultExplorerUrl: z.url().nullable(),
    deployTransactionHash: transactionHashSchema.nullable(),
    deployExplorerUrl: z.url().nullable(),
    state: campaignStateSchema,
    goalStroops: stroopAmountSchema,
    totalStroops: stroopAmountSchema,
    deadline: timestampSchema
  })
  .superRefine((value, context) => {
    if (value.deployExplorerUrl !== null && value.deployTransactionHash === null) {
      context.addIssue({
        code: "custom",
        path: ["deployExplorerUrl"],
        message: "A deploy explorer link requires the deploy transaction hash"
      });
    }
  });

export type AdminEvidenceVault = z.infer<typeof adminEvidenceVaultSchema>;

/** One contribute transaction the chain confirmed (`observedAt` is the confirming chain read). */
export const adminEvidenceContributionSchema = z.strictObject({
  transactionHash: transactionHashSchema,
  investorAccountId: stellarAccountIdSchema,
  amountStroops: stroopAmountSchema,
  observedAt: timestampSchema,
  explorerUrl: z.url().nullable()
});

export type AdminEvidenceContribution = z.infer<typeof adminEvidenceContributionSchema>;

/**
 * One revenue-share distribution of the campaign, in any state. The total is
 * the sum of its recipients' payments; the confirmation evidence is present
 * only once Horizon confirmed it, and a failure reason only when it failed.
 */
export const adminEvidenceDistributionSchema = z.strictObject({
  distributionId: revenueShareDistributionIdSchema,
  state: revenueShareDistributionStateSchema,
  period: periodSchema.nullable(),
  transactionHash: transactionHashSchema,
  explorerUrl: z.url().nullable(),
  totalStroops: stroopAmountSchema,
  recipientCount: z.int().positive(),
  createdAt: timestampSchema,
  confirmedAt: timestampSchema.nullable(),
  ledgerSequence: z.string().regex(/^[1-9]\d*$/).nullable(),
  failureReason: stellarFailureReasonSchema.nullable()
});

export type AdminEvidenceDistribution = z.infer<typeof adminEvidenceDistributionSchema>;

/** The reconciliation the API last stored for the campaign — never a fresh chain read. */
export const adminEvidenceReconciliationSchema = z.strictObject({
  status: reconciliationStatusSchema,
  lastReconciledAt: timestampSchema,
  lastDivergedAt: timestampSchema.nullable()
});

export type AdminEvidenceReconciliation = z.infer<typeof adminEvidenceReconciliationSchema>;

export const adminApplicationEvidenceSchema = z.strictObject({
  applicationId: applicationIdSchema,
  applicationState: applicationReviewStateSchema,
  smeReference: z.string().min(1),
  /** The PyME's registered company name; `null` when it has none on record. */
  companyName: z.string().trim().min(1).nullable(),
  decision: adminEvidenceDecisionSchema.nullable(),
  deployment: adminEvidenceDeploymentSchema.nullable(),
  vault: adminEvidenceVaultSchema.nullable(),
  /** Confirmed contributions only, oldest observation first. */
  contributions: z.array(adminEvidenceContributionSchema),
  /** Every distribution of the campaign, oldest first. */
  distributions: z.array(adminEvidenceDistributionSchema),
  reconciliation: adminEvidenceReconciliationSchema.nullable()
});

export type AdminApplicationEvidence = z.infer<typeof adminApplicationEvidenceSchema>;

export function parseAdminApplicationEvidence(input: unknown): AdminApplicationEvidence {
  return adminApplicationEvidenceSchema.parse(input);
}
