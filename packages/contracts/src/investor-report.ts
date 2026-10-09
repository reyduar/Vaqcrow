import { z } from "zod";
import { marketplaceCampaignImageUrlSchema } from "./marketplace.js";
import { xlmAmountSchema } from "./portfolio.js";
import { periodSchema } from "./sme-evidence.js";

/**
 * The investor report read model (`GET /reports`, Feature #430, WU1).
 *
 * Two endpoints serve this contract to **every authenticated role** (owner
 * decision D1): the report itself (KPIs, monthly series, latest distributions)
 * and an independently fetchable sales-by-PyME block, so the web can render its
 * own partial-error state for the sales section. The selected range is
 * month-based (`YYYY-MM`, inclusive); `availableRange` is always returned so the
 * web can build presets and a custom-range picker from the investor's own data,
 * with no hard-coded year.
 *
 * Aggregation is deterministic and server-side (integer `bigint` math); the AI
 * computes nothing here. Money is a canonical seven-decimal XLM string, never a
 * float — `null` is the honest "sin dato" for a missing distribution share, a
 * missing declared sale or a missing image, and is never a fabricated zero.
 *
 * No PII crosses the wire: the caller is always the verified principal and the
 * API resolves the Stellar account server-side, so no account id is carried.
 * `imageUrl` reuses the exact API-relative campaign-image rule of the
 * marketplace so a storage path or absolute URL can never satisfy it.
 */

/** The selected report window; both bounds are the same `YYYY-MM` month form. */
export const reportRangeSchema = z
  .strictObject({ from: periodSchema, to: periodSchema })
  .refine((range) => range.from <= range.to, {
    message: "to must not be before from",
    path: ["to"]
  });

export type ReportRange = z.infer<typeof reportRangeSchema>;

/**
 * The bounds the investor actually has data for (across contributions and
 * distributions). Both are `null` for an investor with no data at all, so the
 * web can hide the selector instead of inventing a range.
 */
export const availableRangeSchema = z.strictObject({
  firstPeriod: periodSchema.nullable(),
  lastPeriod: periodSchema.nullable()
});

export type AvailableRange = z.infer<typeof availableRangeSchema>;

/**
 * The report's headline figures for the selected range.
 * `confirmedDistributionsXlm` is a plain canonical amount (`0.0000000` is a real
 * zero — a sum over a known set); `pendingDistributionsXlm` is `null` when
 * nothing is pending, because an absence is not a zero.
 */
export const reportKpisSchema = z.strictObject({
  contributedXlm: xlmAmountSchema,
  confirmedDistributionsXlm: xlmAmountSchema,
  pendingDistributionsCount: z.number().int().nonnegative(),
  pendingDistributionsXlm: xlmAmountSchema.nullable(),
  campaignsCount: z.number().int().nonnegative()
});

export type ReportKpis = z.infer<typeof reportKpisSchema>;

export const reportMonthlyPointStateSchema = z.enum(["confirmed", "pending", "none"]);

export type ReportMonthlyPointState = z.infer<typeof reportMonthlyPointStateSchema>;

/**
 * One month of the series. `confirmed` wins when a month has both a confirmed
 * and a submitted distribution; `amountXlm` is that month's confirmed (or, when
 * only pending, its submitted) total and is `null` for a `none` month.
 */
export const reportMonthlyPointSchema = z.strictObject({
  period: periodSchema,
  amountXlm: xlmAmountSchema.nullable(),
  state: reportMonthlyPointStateSchema
});

export type ReportMonthlyPoint = z.infer<typeof reportMonthlyPointSchema>;

export const reportLatestDistributionStateSchema = z.enum(["confirmed", "submitted", "failed"]);

export type ReportLatestDistributionState = z.infer<typeof reportLatestDistributionStateSchema>;

/**
 * One recent distribution addressed to the investor. `date` is the persisted
 * confirmation time (or, for a not-yet-confirmed one, its recorded time);
 * `declaredSalesArs` is the PyME's declared sale for that distribution's period
 * when a `business_sales_period` row exists (`null` = sin dato); `shareXlm` is
 * this investor's allocation. The state vocabulary is the persisted one.
 */
export const reportLatestDistributionSchema = z.strictObject({
  date: z.iso.datetime({ offset: true }),
  pyme: z.string().trim().min(1),
  declaredSalesArs: z.number().int().nonnegative().nullable(),
  shareXlm: xlmAmountSchema.nullable(),
  state: reportLatestDistributionStateSchema
});

export type ReportLatestDistribution = z.infer<typeof reportLatestDistributionSchema>;

export const investorReportSchema = z.strictObject({
  range: reportRangeSchema,
  availableRange: availableRangeSchema,
  isEmpty: z.boolean(),
  kpis: reportKpisSchema,
  monthlySeries: z.array(reportMonthlyPointSchema),
  latestDistributions: z.array(reportLatestDistributionSchema)
});

export type InvestorReport = z.infer<typeof investorReportSchema>;

export const reportSalesByPymeStatusSchema = z.enum(["reported", "missing", "anomalous"]);

export type ReportSalesByPymeStatus = z.infer<typeof reportSalesByPymeStatusSchema>;

/**
 * One declared-sales row for a PyME the investor holds a position in. `salesArs`
 * is `null` exactly for a `missing` month — an absence, never a zero.
 */
export const reportSalesByPymeEntrySchema = z.strictObject({
  name: z.string().trim().min(1),
  sector: z.string().trim().min(1),
  imageUrl: marketplaceCampaignImageUrlSchema.nullable(),
  period: periodSchema,
  salesArs: z.number().int().nonnegative().nullable(),
  status: reportSalesByPymeStatusSchema
});

export type ReportSalesByPymeEntry = z.infer<typeof reportSalesByPymeEntrySchema>;

/** `GET /reports/sales-by-pyme` response: the sales block, fetched on its own. */
export const reportSalesByPymeSchema = z.strictObject({
  pymes: z.array(reportSalesByPymeEntrySchema)
});

export type ReportSalesByPyme = z.infer<typeof reportSalesByPymeSchema>;

export function parseInvestorReport(input: unknown): InvestorReport {
  return investorReportSchema.parse(input);
}

export function parseReportSalesByPyme(input: unknown): ReportSalesByPyme {
  return reportSalesByPymeSchema.parse(input);
}
