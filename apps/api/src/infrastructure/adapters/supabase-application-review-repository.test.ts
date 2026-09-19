import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  parseApplicationId,
  parseCorrelationId,
  parseHumanDecisionCommand
} from "@vaqcrow/contracts";
import { SupabaseApplicationReviewRepository } from "./supabase-application-review-repository.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const ORIGINAL_CORRELATION_ID = parseCorrelationId("33333333-3333-4333-8333-333333333333");
const DECISION = parseHumanDecisionCommand({
  decisionId: "44444444-4444-4444-8444-444444444444",
  applicationId: APPLICATION_ID,
  outcome: "approved",
  actor: "credit-committee@example.test",
  reason: "Synthetic evidence supports this test decision.",
  approvedLimitArs: 5_000_000
});
const DECIDED_AT = "2026-09-19T18:30:00.000Z";

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
  readonly rpc: Array<readonly [functionName: string, params: unknown]>;
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
  const calls: RecordedCalls = { insert: [], update: [], eq: [], rpc: [] };

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

  return {
    client: {
      from: () => builder(),
      rpc: (functionName: string, params: unknown) => {
        calls.rpc.push([functionName, params]);
        return nextResult();
      }
    } as unknown as SupabaseClient,
    calls
  };
}

function decisionRpcRow(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    result_kind: "applied",
    decision_id: DECISION.decisionId,
    application_id: DECISION.applicationId,
    outcome: DECISION.outcome,
    actor: DECISION.actor,
    reason: DECISION.reason,
    approved_limit_ars: String(DECISION.approvedLimitArs),
    decided_at: DECIDED_AT,
    correlation_id: CORRELATION_ID,
    actual_state: null,
    ...overrides
  };
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

  describe("recordHumanDecision", () => {
    it("calls the atomic RPC with exact params and returns an applied decision", async () => {
      const { client, calls } = createFakeSupabaseClient([
        { data: [decisionRpcRow()], error: null }
      ]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.recordHumanDecision({
        command: DECISION,
        correlationId: CORRELATION_ID
      });

      expect(calls.rpc).toEqual([
        [
          "record_human_decision",
          {
            p_decision_id: DECISION.decisionId,
            p_application_id: DECISION.applicationId,
            p_outcome: DECISION.outcome,
            p_actor: DECISION.actor,
            p_reason: DECISION.reason,
            p_approved_limit_ars: DECISION.approvedLimitArs,
            p_correlation_id: CORRELATION_ID
          }
        ]
      ]);
      expect(result).toEqual({
        ok: true,
        value: {
          applied: true,
          record: {
            ...DECISION,
            decidedAt: DECIDED_AT,
            correlationId: CORRELATION_ID
          }
        }
      });
    });

    it("returns the original immutable record for an exact replay", async () => {
      const { client } = createFakeSupabaseClient([
        {
          data: [
            decisionRpcRow({
              result_kind: "replayed",
              correlation_id: ORIGINAL_CORRELATION_ID
            })
          ],
          error: null
        }
      ]);
      const repository = new SupabaseApplicationReviewRepository(client);

      const result = await repository.recordHumanDecision({
        command: DECISION,
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({
        ok: true,
        value: {
          applied: false,
          record: {
            ...DECISION,
            decidedAt: DECIDED_AT,
            correlationId: ORIGINAL_CORRELATION_ID
          }
        }
      });
    });

    it("accepts a safe numeric bigint result", async () => {
      const { client } = createFakeSupabaseClient([
        {
          data: [decisionRpcRow({ approved_limit_ars: DECISION.approvedLimitArs })],
          error: null
        }
      ]);
      const result = await new SupabaseApplicationReviewRepository(client).recordHumanDecision({
        command: DECISION,
        correlationId: CORRELATION_ID
      });

      expect(result).toMatchObject({
        ok: true,
        value: { record: { approvedLimitArs: DECISION.approvedLimitArs } }
      });
    });

    it("maps not_found without claiming success", async () => {
      const { client } = createFakeSupabaseClient([
        { data: [decisionRpcRow({ result_kind: "not_found" })], error: null }
      ]);
      const result = await new SupabaseApplicationReviewRepository(client).recordHumanDecision({
        command: DECISION,
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "not_found" } });
    });

    it("maps state_conflict only after parsing the shared application state", async () => {
      const { client } = createFakeSupabaseClient([
        {
          data: [decisionRpcRow({ result_kind: "state_conflict", actual_state: "rejected" })],
          error: null
        }
      ]);
      const result = await new SupabaseApplicationReviewRepository(client).recordHumanDecision({
        command: DECISION,
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "state_conflict", actualState: "rejected" }
      });
    });

    it("maps idempotency_conflict without exposing the conflicting record", async () => {
      const { client } = createFakeSupabaseClient([
        { data: [decisionRpcRow({ result_kind: "idempotency_conflict" })], error: null }
      ]);
      const result = await new SupabaseApplicationReviewRepository(client).recordHumanDecision({
        command: DECISION,
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "idempotency_conflict" } });
    });

    it("sanitizes Supabase RPC errors", async () => {
      const { client } = createFakeSupabaseClient([
        { data: null, error: fakeError("42501") }
      ]);
      const result = await new SupabaseApplicationReviewRepository(client).recordHumanDecision({
        command: DECISION,
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
      if (result.ok) throw new Error("expected a sanitized repository error");
      expect(result.error).not.toHaveProperty("message");
      expect(result.error).not.toHaveProperty("details");
      expect(result.error).not.toHaveProperty("hint");
    });

    it.each([
      ["zero rows", []],
      ["multiple rows", [decisionRpcRow(), decisionRpcRow()]],
      ["non-array payload", decisionRpcRow()],
      ["unknown result kind", [decisionRpcRow({ result_kind: "unexpected" })]],
      ["unsafe bigint", [decisionRpcRow({ approved_limit_ars: "9007199254740992" })]],
      ["invalid actual state", [decisionRpcRow({ result_kind: "state_conflict", actual_state: "unknown" })]]
    ])("maps malformed RPC output (%s) to unavailable", async (_label, data) => {
      const { client } = createFakeSupabaseClient([{ data, error: null }]);
      const result = await new SupabaseApplicationReviewRepository(client).recordHumanDecision({
        command: DECISION,
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    });

    it("maps a thrown RPC transport failure to unavailable", async () => {
      const { client } = createFakeSupabaseClient([
        { reject: new Error("fetch failed: network unreachable") }
      ]);
      const result = await new SupabaseApplicationReviewRepository(client).recordHumanDecision({
        command: DECISION,
        correlationId: CORRELATION_ID
      });

      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
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
