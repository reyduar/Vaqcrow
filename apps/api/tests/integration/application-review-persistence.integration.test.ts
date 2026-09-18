import type { ApplicationReviewState } from "@vaqcrow/contracts";
import { generateCorrelationId } from "@vaqcrow/contracts";
import { describe, expect, it } from "vitest";
import { SupabaseApplicationReviewRepository } from "../../src/infrastructure/adapters/supabase-application-review-repository.js";
import {
  getPublishableClient,
  getServiceRoleClient,
  hasIntegrationCredentials,
  registerSyntheticCleanupHooks,
  updatedAtAdvanced,
  updatedAtUnchanged
} from "./support/integration-clients.js";
import { syntheticApplicationId } from "./support/synthetic-id.js";

const TABLE = "application_review";

interface RawUpdatedAt {
  readonly updated_at: string;
}

/** Raw service-role select of a single row's `updated_at`, bypassing the adapter's snapshot (which strips timestamps). */
async function selectUpdatedAt(applicationId: string): Promise<string> {
  const { data, error } = await getServiceRoleClient()
    .from(TABLE)
    .select("updated_at")
    .eq("application_id", applicationId)
    .single();
  if (error) {
    throw error;
  }
  return (data as RawUpdatedAt).updated_at;
}

/**
 * Live integration suite against the real Supabase/Postgres instance backing
 * `application_review`. Credential-gated: skips entirely (not fails) when
 * `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`
 * are not all present. Every row written stays inside the reserved synthetic
 * `deadbeef-...` id range and is deleted by the shared cleanup hooks below.
 */
describe.skipIf(!hasIntegrationCredentials())("SupabaseApplicationReviewRepository (live integration)", () => {
  registerSyntheticCleanupHooks();

  function repository(): SupabaseApplicationReviewRepository {
    return new SupabaseApplicationReviewRepository(getServiceRoleClient());
  }

  it("persists a new row on create and applies a matching-state transition (applied: true)", async () => {
    const applicationId = syntheticApplicationId();
    const correlationId = generateCorrelationId();

    const created = await repository().create({ applicationId, state: "draft", correlationId });
    expect(created).toEqual({ ok: true, value: { applicationId, state: "draft" } });

    const found = await repository().findById(applicationId);
    expect(found).toEqual({ ok: true, value: { applicationId, state: "draft" } });

    const transitioned = await repository().transition({
      applicationId,
      from: "draft",
      to: "awaiting_assessment",
      correlationId
    });
    expect(transitioned).toEqual({
      ok: true,
      value: { applied: true, snapshot: { applicationId, state: "awaiting_assessment" } }
    });
  });

  it("denies a publishable-key client with a 42501 permission error on select, insert, and update", async () => {
    const applicationId = syntheticApplicationId();
    const correlationId = generateCorrelationId();

    const created = await repository().create({ applicationId, state: "draft", correlationId });
    expect(created.ok).toBe(true);

    const publishable = getPublishableClient();

    const selectResult = await publishable.from(TABLE).select().eq("application_id", applicationId);
    expect(selectResult.error?.code).toBe("42501");
    expect(selectResult.data).toBeNull();

    const insertResult = await publishable
      .from(TABLE)
      .insert({ application_id: syntheticApplicationId(), state: "draft", last_correlation_id: correlationId });
    expect(insertResult.error?.code).toBe("42501");

    const updateResult = await publishable.from(TABLE).update({ state: "rejected" }).eq("application_id", applicationId);
    expect(updateResult.error?.code).toBe("42501");

    // The service-role client still reads the same row, unaffected by the denied attempts.
    const stillThere = await repository().findById(applicationId);
    expect(stillThere).toEqual({ ok: true, value: { applicationId, state: "draft" } });
  });

  it("rejects an out-of-vocabulary state at the database boundary (CHECK constraint)", async () => {
    const rawApplicationId = syntheticApplicationId();
    const correlationId = generateCorrelationId();

    const rawInsert = await getServiceRoleClient()
      .from(TABLE)
      .insert({ application_id: rawApplicationId, state: "not_a_real_state", last_correlation_id: correlationId });
    expect(rawInsert.status).toBe(400);
    expect(rawInsert.error?.code).toBe("23514");

    const rawResidue = await getServiceRoleClient().from(TABLE).select().eq("application_id", rawApplicationId);
    expect(rawResidue.data).toEqual([]);

    const adapterApplicationId = syntheticApplicationId();
    const adapterResult = await repository().create({
      applicationId: adapterApplicationId,
      state: "not_a_real_state" as ApplicationReviewState,
      correlationId
    });
    expect(adapterResult).toEqual({ ok: false, error: { code: "invalid_state" } });

    const adapterResidue = await getServiceRoleClient().from(TABLE).select().eq("application_id", adapterApplicationId);
    expect(adapterResidue.data).toEqual([]);
  });

  it("reports already_exists on a duplicate create, leaving the existing row unchanged", async () => {
    const applicationId = syntheticApplicationId();
    const correlationId = generateCorrelationId();

    const first = await repository().create({ applicationId, state: "draft", correlationId });
    expect(first.ok).toBe(true);

    const second = await repository().create({
      applicationId,
      state: "awaiting_assessment",
      correlationId: generateCorrelationId()
    });
    expect(second).toEqual({ ok: false, error: { code: "already_exists" } });

    const stillOriginal = await repository().findById(applicationId);
    expect(stillOriginal).toEqual({ ok: true, value: { applicationId, state: "draft" } });
  });

  it("reports state_conflict with the actual state when the expected from state is stale", async () => {
    const applicationId = syntheticApplicationId();
    const correlationId = generateCorrelationId();

    await repository().create({ applicationId, state: "draft", correlationId });
    const advanced = await repository().transition({
      applicationId,
      from: "draft",
      to: "awaiting_assessment",
      correlationId
    });
    expect(advanced).toEqual({
      ok: true,
      value: { applied: true, snapshot: { applicationId, state: "awaiting_assessment" } }
    });

    const stale = await repository().transition({
      applicationId,
      from: "draft",
      to: "human_review",
      correlationId
    });
    expect(stale).toEqual({ ok: false, error: { code: "state_conflict", actualState: "awaiting_assessment" } });

    const unchanged = await repository().findById(applicationId);
    expect(unchanged).toEqual({ ok: true, value: { applicationId, state: "awaiting_assessment" } });
  });

  it("advances updated_at strictly when a transition is applied, without the client supplying it", async () => {
    const applicationId = syntheticApplicationId();
    const correlationId = generateCorrelationId();

    await repository().create({ applicationId, state: "draft", correlationId });
    const beforeTransition = await selectUpdatedAt(applicationId);

    const transitioned = await repository().transition({
      applicationId,
      from: "draft",
      to: "awaiting_assessment",
      correlationId
    });
    expect(transitioned.ok).toBe(true);

    const afterTransition = await selectUpdatedAt(applicationId);
    expect(updatedAtAdvanced(beforeTransition, afterTransition)).toBe(true);
  });

  it("is idempotent on replay: resending the identical {from, to} pair reports applied: false with updated_at unchanged", async () => {
    const applicationId = syntheticApplicationId();
    const correlationId = generateCorrelationId();

    await repository().create({ applicationId, state: "draft", correlationId });

    const firstTransition = await repository().transition({
      applicationId,
      from: "draft",
      to: "awaiting_assessment",
      correlationId
    });
    expect(firstTransition).toEqual({
      ok: true,
      value: { applied: true, snapshot: { applicationId, state: "awaiting_assessment" } }
    });
    const updatedAtAfterFirst = await selectUpdatedAt(applicationId);

    // Row already left the "draft" `from` state, so this conditional UPDATE matches
    // zero rows and the adapter takes the zero-row-disambiguation replay path.
    const secondTransition = await repository().transition({
      applicationId,
      from: "draft",
      to: "awaiting_assessment",
      correlationId
    });
    expect(secondTransition).toEqual({
      ok: true,
      value: { applied: false, snapshot: { applicationId, state: "awaiting_assessment" } }
    });
    const updatedAtAfterSecond = await selectUpdatedAt(applicationId);

    expect(updatedAtUnchanged(updatedAtAfterFirst, updatedAtAfterSecond)).toBe(true);
  });
});
