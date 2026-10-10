import { investorReportSchema, reportSalesByPymeSchema } from "@vaqcrow/contracts";
import type { AvailableRange, InvestorReport, ReportRange, ReportSalesByPyme } from "@vaqcrow/contracts";
import { contractExplorerUrl, transactionExplorerUrl } from "../explorer-url.js";
import type {
  ReportContributionRecord,
  ReportContributionTransactionRecord,
  ReportDistributionRecord,
  ReportsRepositoryPort,
  ReportSalesByPymeRecord
} from "../ports/reports-repository-port.js";
import type { WalletRepositoryPort } from "../ports/wallet-repository-port.js";

/**
 * The investor report read model (#430, WU1).
 *
 * The investor's Stellar account is resolved **server-side** from the verified
 * principal's stored profile key — `application/` only depends on the
 * vendor-free `WalletRepositoryPort`. A caller-supplied account is never read,
 * so a principal can only ever build a report from its own rows.
 *
 * Aggregation is deterministic and integer-only: money stays `bigint` until the
 * final canonical XLM string, and periods are compared as `YYYY-MM` strings
 * (never a `Date`, so there is no timezone drift in bucketing). "Aportado en el
 * período" is dated by `coalesce(last_observed_at, created_at)` — an
 * approximation, because a contribution is a cumulative per-account row with no
 * per-event date. A missing declared sale, pending total or distribution share
 * is `null` ("sin dato"), never a fabricated zero.
 *
 * Testnet transparency (#438/WU3): every latest distribution carries its hash,
 * and the report lists the investor's **observed** contribute transactions whose
 * observation month falls in the range, each with its hash, amount and vault.
 * Explorer links are built from `explorerBaseUrl` and are `null` without one.
 */

const STROOPS_PER_XLM = 10_000_000n;
/** The default window when the caller supplies no range: the last six months. */
const DEFAULT_RANGE_MONTHS = 6;
/** The report shows only the most recent distributions, newest first. */
const LATEST_DISTRIBUTIONS_LIMIT = 5;
/** A distribution with no resolvable campaign (a legacy row) shows this neutral label. */
const NEUTRAL_PYME_LABEL = "PyME";
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface GetInvestorReportDependencies {
  /** Resolves the verified principal's stored Stellar key (its profile column). */
  readonly wallets: Pick<WalletRepositoryPort, "readPublicKey">;
  readonly reports: Pick<
    ReportsRepositoryPort,
    "listContributions" | "listDistributions" | "listSalesByPyme" | "listContributionTransactions"
  >;
  /** Injected for deterministic default ranges; `index.ts` passes `() => new Date()`. */
  readonly now: () => Date;
  /**
   * `StellarConfig.explorerUrl` (#438/WU3); `undefined` on the `local` network,
   * which turns every explorer link into `null`. The hashes are still returned.
   */
  readonly explorerBaseUrl: string | undefined;
}

/** The optional `from`/`to` query input; both are `YYYY-MM` months. */
export interface ReportRangeInput {
  readonly from?: string;
  readonly to?: string;
}

export type GetInvestorReportError = { readonly code: "invalid_request" } | { readonly code: "unavailable" };

export type GetInvestorReportResult =
  | { readonly ok: true; readonly value: InvestorReport }
  | { readonly ok: false; readonly error: GetInvestorReportError };

export type GetReportSalesByPymeResult =
  | { readonly ok: true; readonly value: ReportSalesByPyme }
  | { readonly ok: false; readonly error: GetInvestorReportError };

type RangeResolution =
  | { readonly kind: "explicit"; readonly range: ReportRange }
  | { readonly kind: "default" }
  | { readonly kind: "invalid" };

export async function getInvestorReport(
  dependencies: GetInvestorReportDependencies,
  input: ReportRangeInput & { readonly userId: string }
): Promise<GetInvestorReportResult> {
  // A malformed range is rejected before any read, so an invalid query never
  // reaches the database.
  const resolved = resolveRangeInput(input);
  if (resolved.kind === "invalid") return { ok: false, error: { code: "invalid_request" } };

  const key = await dependencies.wallets.readPublicKey(input.userId);
  if (!key.ok) return { ok: false, error: { code: "unavailable" } };

  if (key.value === null) {
    const range = resolved.kind === "explicit" ? resolved.range : defaultRange(EMPTY_AVAILABLE, dependencies.now());
    return { ok: true, value: buildReport([], [], [], range, dependencies.explorerBaseUrl) };
  }

  const [contributions, distributions, transactions] = await Promise.all([
    dependencies.reports.listContributions(key.value),
    dependencies.reports.listDistributions(key.value),
    dependencies.reports.listContributionTransactions(key.value)
  ]);
  if (!contributions.ok || !distributions.ok || !transactions.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  try {
    const range =
      resolved.kind === "explicit"
        ? resolved.range
        : defaultRange(availableRangeOf(contributions.value, distributions.value), dependencies.now());
    return {
      ok: true,
      value: buildReport(contributions.value, distributions.value, transactions.value, range, dependencies.explorerBaseUrl)
    };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}

export async function getInvestorReportSalesByPyme(
  dependencies: GetInvestorReportDependencies,
  input: ReportRangeInput & { readonly userId: string }
): Promise<GetReportSalesByPymeResult> {
  const resolved = resolveRangeInput(input);
  if (resolved.kind === "invalid") return { ok: false, error: { code: "invalid_request" } };

  const key = await dependencies.wallets.readPublicKey(input.userId);
  if (!key.ok) return { ok: false, error: { code: "unavailable" } };

  // No key means no account to read: an empty block, not a failure.
  if (key.value === null) return { ok: true, value: { pymes: [] } };

  const records = await dependencies.reports.listSalesByPyme(key.value);
  if (!records.ok) return { ok: false, error: { code: "unavailable" } };

  try {
    const range =
      resolved.kind === "explicit"
        ? resolved.range
        : defaultRange(salesAvailableRange(records.value), dependencies.now());
    const pymes = [...records.value]
      .filter((record) => range.from <= record.period && record.period <= range.to)
      .sort(compareSales)
      .map((record) => ({
        name: record.name,
        sector: record.sector,
        imageUrl: `/marketplace/campaigns/${record.campaignId}/image`,
        period: record.period,
        salesArs: record.salesArs === null ? null : Number(record.salesArs),
        status: record.status
      }));

    return { ok: true, value: reportSalesByPymeSchema.parse({ pymes }) };
  } catch {
    return { ok: false, error: { code: "unavailable" } };
  }
}

/** Canonical XLM: exactly seven decimals, `bigint` math, never a float. */
function toXlm(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_XLM;
  const fraction = (stroops % STROOPS_PER_XLM).toString().padStart(7, "0");
  return `${whole}.${fraction}`;
}

/** The `YYYY-MM` prefix of an ISO timestamp; `undefined` when it is malformed. */
function monthOf(iso: string): string | undefined {
  const month = iso.slice(0, 7);
  return PERIOD_PATTERN.test(month) ? month : undefined;
}

/** The current month in UTC, used only to anchor an empty default range. */
function currentMonth(now: Date): string {
  const year = now.getUTCFullYear().toString().padStart(4, "0");
  const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

/** Adds whole months to a `YYYY-MM` period with integer math only. */
function addMonths(period: string, delta: number): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const absolute = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = (((absolute % 12) + 12) % 12) + 1;
  return `${nextYear.toString().padStart(4, "0")}-${nextMonth.toString().padStart(2, "0")}`;
}

/** Every month from `from` to `to` inclusive, in order. */
function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = from;
  while (cursor <= to && months.length < 1200) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function resolveRangeInput(input: ReportRangeInput): RangeResolution {
  const { from, to } = input;
  if (from === undefined && to === undefined) return { kind: "default" };
  if (typeof from !== "string" || typeof to !== "string") return { kind: "invalid" };
  if (!PERIOD_PATTERN.test(from) || !PERIOD_PATTERN.test(to)) return { kind: "invalid" };
  if (from > to) return { kind: "invalid" };
  return { kind: "explicit", range: { from, to } };
}

function defaultRange(available: AvailableRange, now: Date): ReportRange {
  const anchor = available.lastPeriod ?? currentMonth(now);
  return { from: addMonths(anchor, -(DEFAULT_RANGE_MONTHS - 1)), to: anchor };
}

const EMPTY_AVAILABLE: AvailableRange = { firstPeriod: null, lastPeriod: null };

function toEpoch(iso: string): number {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

function availableRangeOf(
  contributions: readonly ReportContributionRecord[],
  distributions: readonly ReportDistributionRecord[]
): AvailableRange {
  const periods: string[] = [];
  for (const contribution of contributions) {
    const month = monthOf(contribution.observedAt);
    if (month !== undefined) periods.push(month);
  }
  for (const distribution of distributions) {
    if (distribution.period !== null && PERIOD_PATTERN.test(distribution.period)) periods.push(distribution.period);
  }
  if (periods.length === 0) return EMPTY_AVAILABLE;
  periods.sort();
  return { firstPeriod: periods[0] ?? null, lastPeriod: periods[periods.length - 1] ?? null };
}

function salesAvailableRange(records: readonly ReportSalesByPymeRecord[]): AvailableRange {
  const periods = records.map((record) => record.period).filter((period) => PERIOD_PATTERN.test(period));
  if (periods.length === 0) return EMPTY_AVAILABLE;
  periods.sort();
  return { firstPeriod: periods[0] ?? null, lastPeriod: periods[periods.length - 1] ?? null };
}

function compareSales(a: ReportSalesByPymeRecord, b: ReportSalesByPymeRecord): number {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  if (a.period !== b.period) return a.period < b.period ? -1 : 1;
  return 0;
}

function transactionLink(base: string | undefined, hash: string): string | null {
  return base === undefined ? null : transactionExplorerUrl(base, hash);
}

function contractLink(base: string | undefined, address: string): string | null {
  return base === undefined ? null : contractExplorerUrl(base, address);
}

/**
 * The observed contribute transactions whose observation month is in the range,
 * newest first (the hash breaks ties so the order is stable).
 */
function contributionTransactionsInRange(
  transactions: readonly ReportContributionTransactionRecord[],
  range: ReportRange,
  explorerBaseUrl: string | undefined
): InvestorReport["contributionTransactions"] {
  return transactions
    .filter((transaction) => {
      const month = monthOf(transaction.observedAt);
      return month !== undefined && range.from <= month && month <= range.to;
    })
    .sort(
      (a, b) =>
        toEpoch(b.observedAt) - toEpoch(a.observedAt) ||
        (a.transactionHash < b.transactionHash ? -1 : a.transactionHash > b.transactionHash ? 1 : 0)
    )
    .map((transaction) => ({
      date: transaction.observedAt,
      pyme: transaction.campaignName ?? NEUTRAL_PYME_LABEL,
      amountXlm: toXlm(transaction.amountStroops),
      transactionHash: transaction.transactionHash,
      explorerUrl: transactionLink(explorerBaseUrl, transaction.transactionHash),
      vaultAddress: transaction.vaultAddress,
      vaultExplorerUrl: contractLink(explorerBaseUrl, transaction.vaultAddress)
    }));
}

function buildReport(
  contributions: readonly ReportContributionRecord[],
  distributions: readonly ReportDistributionRecord[],
  transactions: readonly ReportContributionTransactionRecord[],
  range: ReportRange,
  explorerBaseUrl: string | undefined
): InvestorReport {
  const availableRange = availableRangeOf(contributions, distributions);

  let contributedStroops = 0n;
  const campaignIds = new Set<string>();
  for (const contribution of contributions) {
    const month = monthOf(contribution.observedAt);
    if (month === undefined || month < range.from || month > range.to) continue;
    contributedStroops += contribution.contributionStroops;
    campaignIds.add(contribution.campaignId);
  }

  let confirmedStroops = 0n;
  let pendingStroops = 0n;
  let pendingCount = 0;
  const buckets = new Map<string, { confirmed: bigint; pending: bigint }>();
  const inRange: ReportDistributionRecord[] = [];
  for (const distribution of distributions) {
    const period = distribution.period;
    if (period === null || period < range.from || period > range.to) continue;
    inRange.push(distribution);

    if (distribution.state === "confirmed") {
      confirmedStroops += distribution.amountStroops;
    } else if (distribution.state === "submitted") {
      pendingStroops += distribution.amountStroops;
      pendingCount += 1;
    }

    const bucket = buckets.get(period) ?? { confirmed: 0n, pending: 0n };
    if (distribution.state === "confirmed") bucket.confirmed += distribution.amountStroops;
    else if (distribution.state === "submitted") bucket.pending += distribution.amountStroops;
    buckets.set(period, bucket);
  }

  // An investor with no contributions and no distributions has no axis to show:
  // the series is empty and `isEmpty` drives the UI's empty state. Once the
  // investor has any data, the series spans the whole selected range so the
  // month axis is continuous.
  const monthlySeries =
    availableRange.firstPeriod === null
      ? []
      : monthRange(range.from, range.to).map((period) => {
          const bucket = buckets.get(period);
          if (bucket !== undefined && bucket.confirmed > 0n) {
            return { period, amountXlm: toXlm(bucket.confirmed), state: "confirmed" as const };
          }
          if (bucket !== undefined && bucket.pending > 0n) {
            return { period, amountXlm: toXlm(bucket.pending), state: "pending" as const };
          }
          return { period, amountXlm: null, state: "none" as const };
        });

  const latestDistributions = [...inRange]
    .sort(
      (a, b) =>
        toEpoch(b.confirmedAt ?? b.recordedAt) - toEpoch(a.confirmedAt ?? a.recordedAt) ||
        (a.distributionId < b.distributionId ? 1 : -1)
    )
    .slice(0, LATEST_DISTRIBUTIONS_LIMIT)
    .map((distribution) => ({
      date: distribution.confirmedAt ?? distribution.recordedAt,
      pyme: distribution.campaignName ?? NEUTRAL_PYME_LABEL,
      declaredSalesArs: distribution.declaredSalesArs === null ? null : Number(distribution.declaredSalesArs),
      shareXlm: toXlm(distribution.amountStroops),
      state: distribution.state,
      transactionHash: distribution.transactionHash,
      explorerUrl: transactionLink(explorerBaseUrl, distribution.transactionHash)
    }));

  const contributionTransactions = contributionTransactionsInRange(transactions, range, explorerBaseUrl);

  return investorReportSchema.parse({
    range,
    availableRange,
    // An observed contribute transaction in the range is data too: its month can
    // differ from the cumulative row's `coalesce(last_observed_at, created_at)`.
    isEmpty: campaignIds.size === 0 && inRange.length === 0 && contributionTransactions.length === 0,
    kpis: {
      contributedXlm: toXlm(contributedStroops),
      confirmedDistributionsXlm: toXlm(confirmedStroops),
      pendingDistributionsCount: pendingCount,
      pendingDistributionsXlm: pendingCount === 0 ? null : toXlm(pendingStroops),
      campaignsCount: campaignIds.size
    },
    monthlySeries,
    latestDistributions,
    contributionTransactions
  });
}
