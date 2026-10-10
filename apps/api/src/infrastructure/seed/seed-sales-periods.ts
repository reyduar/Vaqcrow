import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SalesDataProviderPort } from "../../application/ports/sales-data-provider-port.js";
import type { SalesPeriodRepositoryPort } from "../../application/ports/sales-period-repository-port.js";
import { toSalesPeriodRecords } from "../adapters/supabase-sales-period-repository.js";
import { SupabaseSalesPeriodRepository } from "../adapters/supabase-sales-period-repository.js";

/**
 * Manual, idempotent backfill of the persisted monthly sales series
 * (#422/WU2b).
 *
 * New businesses get their series at creation (`SupabaseBusinessRepository`),
 * but a business registered before this work unit has none. This one-off fills
 * them: for every business it persists the exact series the deterministic sales
 * provider serves, so the campaign detail and the PyME's sales feed agree. The
 * write is an `upsert` on `(business_id, period)`, so it is safe to run
 * repeatedly and never advances or duplicates the feed.
 *
 * Run per profile with
 * `pnpm --filter @vaqcrow/api seed:sales-periods:docker|cloud`; it is never
 * invoked at API startup. It reads no secrets into output (only the service
 * role already in the profile's env file).
 */

export const SALES_SEED_ENV_NAMES = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export interface SeedEnv {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
}

/** Reports missing variables by name only, never by value. */
export function parseSalesSeedEnv(
  env: Readonly<Record<string, string | undefined>>
): { readonly ok: true; readonly value: SeedEnv } | { readonly ok: false; readonly missing: readonly string[] } {
  const missing = SALES_SEED_ENV_NAMES.filter((name) => {
    const value = env[name]?.trim();
    return value === undefined || value === "";
  });
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    value: {
      supabaseUrl: env["SUPABASE_URL"]!.trim(),
      serviceRoleKey: env["SUPABASE_SERVICE_ROLE_KEY"]!.trim()
    }
  };
}

export interface BackfillDependencies {
  readonly listBusinessIds: () => Promise<readonly string[]>;
  readonly provider: Pick<SalesDataProviderPort, "getPeriods">;
  readonly repository: Pick<SalesPeriodRepositoryPort, "saveForBusiness">;
}

export interface BackfillOutcome {
  readonly seeded: number;
  readonly unavailable: number;
  readonly failed: number;
}

/**
 * Backfills every listed business. Idempotent by construction (the repository
 * upserts on the primary key); a provider failure for one business is counted
 * and does not stop the rest.
 */
export async function backfillBusinessSalesPeriods(
  dependencies: BackfillDependencies
): Promise<BackfillOutcome> {
  let seeded = 0;
  let unavailable = 0;
  let failed = 0;

  const businessIds = await dependencies.listBusinessIds();
  for (const businessId of businessIds) {
    const periods = await dependencies.provider.getPeriods(businessId);
    if (!periods.ok) {
      unavailable += 1;
      continue;
    }
    const saved = await dependencies.repository.saveForBusiness({
      businessId,
      periods: toSalesPeriodRecords(periods.value)
    });
    if (saved.ok) {
      seeded += 1;
    } else {
      failed += 1;
    }
  }

  return { seeded, unavailable, failed };
}

/** Lists the ids of every registered company. */
async function listBusinessIds(client: SupabaseClient): Promise<readonly string[]> {
  const { data, error } = await client.from("businesses").select("id");
  if (error) throw new Error(`listing businesses failed: ${error.code ?? "unknown"}`);
  if (!Array.isArray(data)) throw new Error("listing businesses returned no rows array");
  return data
    .map((row) => (typeof row === "object" && row !== null ? (row as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function runSeedSalesPeriods(dependencies: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly provider: SalesDataProviderPort;
  readonly print: (line: string) => void;
}): Promise<number> {
  const parsed = parseSalesSeedEnv(dependencies.env);
  if (!parsed.ok) {
    dependencies.print(`Cannot seed sales periods; set: ${parsed.missing.join(", ")}`);
    return 1;
  }

  const client = createClient(parsed.value.supabaseUrl, parsed.value.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const repository = new SupabaseSalesPeriodRepository(client);

  const outcome = await backfillBusinessSalesPeriods({
    listBusinessIds: () => listBusinessIds(client),
    provider: dependencies.provider,
    repository
  });

  dependencies.print(
    `Sales periods seeded: ${outcome.seeded} businesses (${outcome.unavailable} unavailable, ${outcome.failed} failed).`
  );
  return outcome.failed > 0 ? 1 : 0;
}
