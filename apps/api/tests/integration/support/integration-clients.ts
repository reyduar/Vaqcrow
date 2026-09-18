import type { PostgrestResponse, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach } from "vitest";
import {
  createPublishableSupabaseClient,
  createSupabaseClient
} from "../../../src/infrastructure/supabase/create-supabase-client.js";
import {
  clearRegisteredSyntheticApplicationIds,
  registeredSyntheticApplicationIds,
  SYNTHETIC_HI,
  SYNTHETIC_LO
} from "./synthetic-id.js";

const REQUIRED_ENV_VARS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY"] as const;

const APPLICATION_REVIEW_TABLE = "application_review";

/** True only when every credential required to run the live suite is present. */
export function hasIntegrationCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return REQUIRED_ENV_VARS.every((key) => Boolean(env[key]));
}

let serviceRoleClient: SupabaseClient | undefined;
let publishableClient: SupabaseClient | undefined;

/** Lazily-created, process-wide service-role client for setup/teardown and privileged assertions. */
export function getServiceRoleClient(): SupabaseClient {
  serviceRoleClient ??= createSupabaseClient();
  return serviceRoleClient;
}

/** Lazily-created, process-wide publishable-key client for non-privileged access assertions. */
export function getPublishableClient(): SupabaseClient {
  publishableClient ??= createPublishableSupabaseClient();
  return publishableClient;
}

/**
 * Normalizes a PostgREST response into the rows observed by the caller: an
 * empty array on `42501` (permission denied), the returned rows otherwise,
 * and a re-thrown error for anything else. Never masks an unexpected error
 * as an empty result.
 */
export function observedRows<T>(response: PostgrestResponse<T>): readonly T[] {
  if (response.error) {
    if (response.error.code === "42501") {
      return [];
    }
    throw response.error;
  }
  return response.data ?? [];
}

async function deleteSyntheticApplicationRows(applicationIds: readonly string[]): Promise<void> {
  if (applicationIds.length === 0) {
    return;
  }
  const { error } = await getServiceRoleClient()
    .from(APPLICATION_REVIEW_TABLE)
    .delete()
    .in("application_id", applicationIds);
  if (error) {
    throw error;
  }
}

async function assertNoSyntheticResidue(): Promise<void> {
  const { data, error } = await getServiceRoleClient()
    .from(APPLICATION_REVIEW_TABLE)
    .select("application_id")
    .gte("application_id", SYNTHETIC_LO)
    .lte("application_id", SYNTHETIC_HI);
  if (error) {
    throw error;
  }
  if ((data ?? []).length > 0) {
    throw new Error(
      `Synthetic residue detected: ${(data ?? []).length} row(s) remain in the reserved ` +
        `range [${SYNTHETIC_LO}, ${SYNTHETIC_HI}] after cleanup`
    );
  }
}

/**
 * Wires the suite-wide cleanup contract: an `afterEach` that deletes every
 * synthetic row registered by the test that just ran, and an `afterAll`
 * residue sweep that proves the reserved range is empty again. Call once
 * per integration test file, inside its top-level `describe`.
 */
export function registerSyntheticCleanupHooks(): void {
  afterEach(async () => {
    const ids = registeredSyntheticApplicationIds();
    clearRegisteredSyntheticApplicationIds();
    await deleteSyntheticApplicationRows(ids);
  });

  afterAll(async () => {
    await assertNoSyntheticResidue();
  });
}

/**
 * Strict `updated_at` advancement check: the value must differ from the
 * prior reading AND not be ordered before it. No tolerance window — both
 * timestamps come from `now()` in the same Postgres instance.
 */
export function updatedAtAdvanced(previous: string, next: string): boolean {
  return next !== previous && Date.parse(next) >= Date.parse(previous);
}

/** Strict `updated_at` no-op check: the raw string must be byte-identical. */
export function updatedAtUnchanged(previous: string, next: string): boolean {
  return next === previous;
}
