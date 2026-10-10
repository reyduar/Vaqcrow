import { z } from "zod";
import { campaignIdSchema, stellarContractIdSchema } from "./campaign.js";
import { marketplaceCampaignImageUrlSchema } from "./marketplace.js";
import { revenueShareDistributionStateSchema } from "./revenue-share-distribution.js";
import { revenueShareDistributionIdSchema } from "./revenue-share-distribution-id.js";
import { periodSchema } from "./sme-evidence.js";

/**
 * The investor's portfolio read model (`GET /portfolio`, Feature #426, WU1).
 *
 * The endpoint is `INVERSOR`-only and its caller is always the verified
 * principal: the API resolves the investor's Stellar account server-side, so
 * no account id, user id or other caller-supplied identity ever crosses this
 * boundary. Every fact here comes from a confirmed ledger mirror — the
 * campaign's reconciled state and the investor's own contributions and
 * confirmed distributions — never a client assumption.
 *
 * Money is a canonical decimal string with exactly seven decimals (1 XLM =
 * 10,000,000 stroops), never a JSON float: a JavaScript number cannot carry a
 * stroop count exactly above 2^53. `totalDistributionsXlm` is `null` (the
 * honest "sin dato"), never `0.0000000`, when no confirmed distribution
 * exists — a missing amount is never a fabricated zero. `raisedArs` follows the
 * same rule when the campaign predates its FX snapshot.
 *
 * No PII crosses the wire: no owner id, no CUIT, no email, no document path.
 * `imageUrl` follows the exact API-relative rule of the marketplace listing, so
 * a storage object path or an absolute URL can never satisfy it.
 */

/** Canonical XLM: a non-negative decimal string with exactly seven decimals. */
export const xlmAmountSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)\.\d{7}$/, "must be a non-negative decimal string with exactly 7 decimals");

export type XlmAmount = z.infer<typeof xlmAmountSchema>;

/**
 * A Testnet transaction hash as the role read models carry it (#438/WU3): 64
 * lowercase hex characters, the form the XDR hash and the persisted
 * contribution/deploy hashes take.
 */
export const testnetTransactionHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "must be a 64-character lowercase hex hash");

export type TestnetTransactionHash = z.infer<typeof testnetTransactionHashSchema>;

/**
 * An explorer link built by the API from its own explorer base (#438/WU3). It
 * is `null` when that base is undefined (the `local` network has no canonical
 * explorer): the web never builds a link nor knows the network.
 */
export const explorerUrlSchema = z.url().nullable();

/**
 * One **observed** contribute transaction of the investor to this position's
 * campaign (#438/WU3). A transaction that was submitted but never confirmed is
 * not listed, and a contribution made before the hashes were persisted has no
 * entry at all — the honest "sin dato", never an invented hash.
 */
export const portfolioContributionTransactionSchema = z.strictObject({
  transactionHash: testnetTransactionHashSchema,
  /** This transaction's own amount, canonical XLM (7 decimals). */
  amountXlm: xlmAmountSchema,
  /** When the chain read confirmed it (the API's observation, not the ledger close). */
  observedAt: z.iso.datetime({ offset: true }),
  explorerUrl: explorerUrlSchema
});

export type PortfolioContributionTransaction = z.infer<typeof portfolioContributionTransactionSchema>;

/**
 * The position's lifecycle, reusing the detail's vocabulary
 * (`campaignDetailStatusSchema`): `funding` -> "Fondeo abierto", `settled` ->
 * "Meta alcanzada", `refunding` -> "Reembolso disponible". It is derived
 * server-side from the persisted campaign mirror, never from the request.
 */
export const portfolioPositionStatusSchema = z.enum(["funding", "settled", "refunding"]);

export type PortfolioPositionStatus = z.infer<typeof portfolioPositionStatusSchema>;

/**
 * One campaign the investor contributed to. The contribution is the investor's
 * own confirmed stroop amount (a partial contribution is never inflated to the
 * campaign total); the progress fields describe the whole campaign so the card
 * can render its state.
 */
export const portfolioPositionSchema = z.strictObject({
  campaignId: campaignIdSchema,
  name: z.string().trim().min(1),
  sector: z.string().trim().min(1),
  city: z.string().trim().min(1),
  imageUrl: marketplaceCampaignImageUrlSchema.nullable(),
  /** The investor's own confirmed contribution, canonical XLM (7 decimals). */
  contributionXlm: xlmAmountSchema,
  /** The campaign's raised total in ARS, or `null` when it predates its snapshot. */
  raisedArs: z.number().int().nonnegative().nullable(),
  goalArs: z.number().int().nonnegative(),
  fundedPercentBps: z.number().int().min(0).max(10_000),
  status: portfolioPositionStatusSchema,
  closeDate: z.iso.datetime({ offset: true }),
  vaultAddress: stellarContractIdSchema,
  /** The vault's explorer link; `null` without an explorer base. */
  vaultExplorerUrl: explorerUrlSchema,
  /** The investor's own observed contribute transactions to this campaign, oldest first. */
  transactions: z.array(portfolioContributionTransactionSchema)
});

export type PortfolioPosition = z.infer<typeof portfolioPositionSchema>;

/**
 * One revenue-share distribution the investor is a recipient of. The status is
 * the persisted distribution's own vocabulary (`submitted` | `confirmed` |
 * `failed`); only a `confirmed` row has moved money on the ledger.
 * `campaignId`/`campaignName`/`period` are `null` for a legacy distribution
 * recorded before those links existed — never invented.
 */
export const portfolioDistributionSchema = z.strictObject({
  distributionId: revenueShareDistributionIdSchema,
  campaignId: campaignIdSchema.nullable(),
  campaignName: z.string().trim().min(1).nullable(),
  period: periodSchema.nullable(),
  /** This recipient's allocation, canonical XLM (7 decimals). */
  amountXlm: xlmAmountSchema,
  status: revenueShareDistributionStateSchema,
  /** The distribution's Testnet hash; the persisted column is `not null`. */
  transactionHash: testnetTransactionHashSchema,
  explorerUrl: explorerUrlSchema
});

export type PortfolioDistribution = z.infer<typeof portfolioDistributionSchema>;

export const portfolioTotalsSchema = z.strictObject({
  /** Sum of the investor's contributions across every campaign. */
  totalContributedXlm: xlmAmountSchema,
  /**
   * Sum of the investor's **confirmed** distributions. `null` (never
   * `0.0000000`) when nothing has been confirmed yet: a submitted distribution
   * has not moved money and a failed one moved none.
   */
  totalDistributionsXlm: xlmAmountSchema.nullable(),
  campaignCount: z.number().int().nonnegative()
});

export type PortfolioTotals = z.infer<typeof portfolioTotalsSchema>;

export const portfolioSummarySchema = z.strictObject({
  contributions: z.array(portfolioPositionSchema),
  distributions: z.array(portfolioDistributionSchema),
  totals: portfolioTotalsSchema
});

export type PortfolioSummary = z.infer<typeof portfolioSummarySchema>;

export function parsePortfolioSummary(input: unknown): PortfolioSummary {
  return portfolioSummarySchema.parse(input);
}
