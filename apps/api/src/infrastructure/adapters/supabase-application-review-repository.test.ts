import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { parseApplicationId, parseCorrelationId } from "@vaqcrow/contracts";
import { SupabaseApplicationReviewRepository } from "./supabase-application-review-repository.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");

interface FakePostgrestError {
  readonly code: string;
  readonly message: string;
  readonly details: string;
  readonly hint: string;
}

type FakeStep = { readonly data: unknown; readonly error: FakePostgrestError | null } | { readonly reject: Error };

function fakeError(code: string): FakePostgrestError {
  return {
    code,
    message: `simulated message for ${code}`,
    details: `simulated details for ${code}`,
    hint: `simulated hint for ${code}`
  };
}

/** Arguments captured from calls the adapter makes on the fake query builder. */
interface RecordedCalls {
  readonly insert: unknown[];
  readonly update: unknown[];
  readonly eq: Array<readonly [column: string, value: unknown]>;
}

/**
 * Hand-written fake matching the adapter's narrow supabase-js query surface:
 * `.from(table).insert/update/select(...).eq(...).single()/.maybeSingle()`, and the
 * builder itself is thenable so a bare `.select()` (no terminal call) can be awaited
 * directly, exactly like the real PostgrestFilterBuilder.
 *
 * Each call to a terminal step (`.single()`, `.maybeSingle()`, or awaiting the builder)
 * consumes the next scripted `FakeStep` in order, so tests script exactly the sequence
 * of round trips the adapter is expected to make. `insert`/`update`/`eq` arguments are
 * recorded into `calls` so tests can assert the exact payload/filter the adapter sent,
 * not just the response it received back.
 */
function createFakeSupabaseClient(steps: readonly FakeStep[]): { client: SupabaseClient; calls: RecordedCalls } {
  let cursor = 0;
  const calls: RecordedCalls = { insert: [], update: [], eq: [] };

  function nextResult(): Promise<{ data: unknown; error: FakePostgrestError | null }> {
    const step = steps[cursor++];
    if (!step) {
      throw new Error(`createFakeSupabaseClient: no scripted response for call #${cursor}`);
    }
    if ("reject" in step) {
      return Promise.reject(step.reject);
    }
    return Promise.resolve(step);
  }

  function builder(): unknown {
    const self = {
      insert: (payload: unknown) => {
        calls.insert.push(payload);
        return self;
      },
      update: (payload: unknown) => {
        calls.update.push(payload);
        return self;
      },
      select: () => self,
      eq: (column: string, value: unknown) => {
        calls.eq.push([column, value]);
        return self;
      },
      single: () => nextResult(),
      maybeSingle: () => nextResult(),
      then: (onFulfilled: (value: unknown) => unknown, onRejected: (reason: unknown) => unknown) =>
        nextResult().then(onFulfilled, onRejected)
    };
    return self;
  }

  return { client: { from: () => builder() } as unknown as SupabaseClient, calls };
}

describe("SupabaseApplicationReviewRepository", () => {
  describe("create", () => {
    it("maps a unique-violation (23505) to already_exists", async () => {
      const { client } = createFakeSupabaseClient([{ data: null, error: fakeError("23505") }]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.create({
        applicationId: APPLICATION_ID,
        state: "draft",
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "already_exists" } });
    });

    it("returns the inserted row as a snapshot on success", async () => {
      const { client, calls } = createFakeSupabaseClient([
        {
          data: {
            application_id: APPLICATION_ID,
            state: "draft",
            last_correlation_id: CORRELATION_ID,
            created_at: "2026-09-18T00:00:00.000Z",
            updated_at: "2026-09-18T00:00:00.000Z"
          },
          error: null
        }
      ]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.create({
        applicationId: APPLICATION_ID,
        state: "draft",
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, state: "draft" } });
      expect(calls.insert).toEqual([
        { application_id: APPLICATION_ID, state: "draft", last_correlation_id: CORRELATION_ID }
      ]);
    });
  });

  describe("findById", () => {
    it("reports not_found for an unknown application id, distinct from other errors", async () => {
      const { client } = createFakeSupabaseClient([{ data: null, error: null }]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.findById(APPLICATION_ID);

      expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    });

    it("returns the persisted snapshot for a known application id", async () => {
      const { client } = createFakeSupabaseClient([
        {
          data: {
            application_id: APPLICATION_ID,
            state: "human_review",
            last_correlation_id: CORRELATION_ID,
            created_at: "2026-09-18T00:00:00.000Z",
            updated_at: "2026-09-18T00:00:00.000Z"
          },
          error: null
        }
      ]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.findById(APPLICATION_ID);

      expect(result).toEqual({
        ok: true,
        value: { applicationId: APPLICATION_ID, state: "human_review" }
      });
    });
  });

  describe("transition", () => {
    it("applies the transition when exactly one row matches the from state", async () => {
      const { client, calls } = createFakeSupabaseClient([
        {
          data: [
            {
              application_id: APPLICATION_ID,
              state: "human_review",
              last_correlation_id: CORRELATION_ID,
              created_at: "2026-09-18T00:00:00.000Z",
              updated_at: "2026-09-18T00:01:00.000Z"
            }
          ],
          error: null
        }
      ]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.transition({
        applicationId: APPLICATION_ID,
        from: "awaiting_assessment",
        to: "human_review",
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({
        ok: true,
        value: { applied: true, snapshot: { applicationId: APPLICATION_ID, state: "human_review" } }
      });
      expect(calls.update).toEqual([{ state: "human_review", last_correlation_id: CORRELATION_ID }]);
      expect(calls.eq).toEqual([
        ["application_id", APPLICATION_ID],
        ["state", "awaiting_assessment"]
      ]);
    });

    it("reports applied: false (not an error) when the transition was already applied — idempotent replay", async () => {
      const { client, calls } = createFakeSupabaseClient([
        { data: [], error: null },
        {
          data: {
            application_id: APPLICATION_ID,
            state: "human_review",
            last_correlation_id: CORRELATION_ID,
            created_at: "2026-09-18T00:00:00.000Z",
            updated_at: "2026-09-18T00:01:00.000Z"
          },
          error: null
        }
      ]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.transition({
        applicationId: APPLICATION_ID,
        from: "awaiting_assessment",
        to: "human_review",
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({
        ok: true,
        value: { applied: false, snapshot: { applicationId: APPLICATION_ID, state: "human_review" } }
      });
      // Only the initial conditional UPDATE is asserted here; the disambiguation follow-up
      // (findById) issues its own separate .eq("application_id", ...) call afterward.
      expect(calls.update).toEqual([{ state: "human_review", last_correlation_id: CORRELATION_ID }]);
      expect(calls.eq.slice(0, 2)).toEqual([
        ["application_id", APPLICATION_ID],
        ["state", "awaiting_assessment"]
      ]);
    });

    it("reports state_conflict with the actual state when zero rows matched and the row holds a different state", async () => {
      const { client } = createFakeSupabaseClient([
        { data: [], error: null },
        {
          data: {
            application_id: APPLICATION_ID,
            state: "rejected",
            last_correlation_id: CORRELATION_ID,
            created_at: "2026-09-18T00:00:00.000Z",
            updated_at: "2026-09-18T00:01:00.000Z"
          },
          error: null
        }
      ]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.transition({
        applicationId: APPLICATION_ID,
        from: "awaiting_assessment",
        to: "human_review",
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "state_conflict", actualState: "rejected" } });
    });

    it("reports not_found (not state_conflict) when zero rows matched and no row exists at all", async () => {
      const { client } = createFakeSupabaseClient([
        { data: [], error: null },
        { data: null, error: null }
      ]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.transition({
        applicationId: APPLICATION_ID,
        from: "awaiting_assessment",
        to: "human_review",
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    });
  });

  describe("error mapping and sanitization", () => {
    it("maps a check-constraint violation (23514) to invalid_state", async () => {
      const { client } = createFakeSupabaseClient([{ data: null, error: fakeError("23514") }]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.create({
        applicationId: APPLICATION_ID,
        state: "draft",
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "invalid_state" } });
    });

    it("maps an unrecognized Postgres error code (e.g. 42501 permission denied) to unavailable", async () => {
      const { client } = createFakeSupabaseClient([{ data: null, error: fakeError("42501") }]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.findById(APPLICATION_ID);

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });

    it("never returns message, details, or hint on any mapped error, across every operation", async () => {
      const forbiddenKeys = ["message", "details", "hint"];

      const createResult = await new SupabaseApplicationReviewRepository(
        createFakeSupabaseClient([{ data: null, error: fakeError("23505") }]).client
      ).create({ applicationId: APPLICATION_ID, state: "draft", correlationId: CORRELATION_ID });

      const findResult = await new SupabaseApplicationReviewRepository(
        createFakeSupabaseClient([{ data: null, error: fakeError("42501") }]).client
      ).findById(APPLICATION_ID);

      const transitionResult = await new SupabaseApplicationReviewRepository(
        createFakeSupabaseClient([{ data: null, error: fakeError("23514") }]).client
      ).transition({
        applicationId: APPLICATION_ID,
        from: "awaiting_assessment",
        to: "human_review",
        correlationId: CORRELATION_ID
      });

      for (const result of [createResult, findResult, transitionResult]) {
        if (result.ok) {
          throw new Error("expected every scenario in this test to produce an error result");
        }
        for (const forbiddenKey of forbiddenKeys) {
          expect(Object.keys(result.error)).not.toContain(forbiddenKey);
        }
      }
    });

    it("maps a transport-level rejection (thrown by the client) to unavailable", async () => {
      const { client } = createFakeSupabaseClient([{ reject: new Error("fetch failed: network unreachable") }]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.findById(APPLICATION_ID);

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });

    it("excludes last_correlation_id, created_at, and updated_at from every returned snapshot", async () => {
      const { client } = createFakeSupabaseClient([
        {
          data: {
            application_id: APPLICATION_ID,
            state: "draft",
            last_correlation_id: CORRELATION_ID,
            created_at: "2026-09-18T00:00:00.000Z",
            updated_at: "2026-09-18T00:00:00.000Z"
          },
          error: null
        }
      ]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.findById(APPLICATION_ID);

      if (!result.ok) {
        throw new Error("expected findById to resolve the snapshot successfully");
      }
      expect(Object.keys(result.value).sort()).toEqual(["applicationId", "state"]);
      expect(result.value).not.toHaveProperty("last_correlation_id");
      expect(result.value).not.toHaveProperty("created_at");
      expect(result.value).not.toHaveProperty("updated_at");
    });
  });
});
