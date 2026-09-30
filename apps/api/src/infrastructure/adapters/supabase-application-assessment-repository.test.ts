import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseApplicationId,
  parseAssessmentHandoffId,
  parseCorrelationId
} from "@vaqcrow/contracts";
import type { ApplicationAssessment, AssessmentProviderProvenance } from "@vaqcrow/contracts";
import { SupabaseApplicationAssessmentRepository } from "./supabase-application-assessment-repository.js";

const APPLICATION_ID = parseApplicationId("11111111-1111-4111-8111-111111111111");
const CORRELATION_ID = parseCorrelationId("22222222-2222-4222-8222-222222222222");
const ATTEMPT_ID = parseAssessmentHandoffId("44444444-4444-4444-8444-444444444444");

const ASSESSMENT: ApplicationAssessment = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [],
  missingData: [],
  recommendedAction: "human_review",
  questions: []
};

const METADATA: AssessmentProviderProvenance = {
  model: "demo-model",
  promptVersion: "v1",
  generatedAt: "2026-09-30T12:00:00.000Z",
  source: "simulated"
};

const RECORDED_AT = "2026-09-30T12:00:01.000Z";

const RPC_ROW = {
  result_kind: "applied",
  application_id: APPLICATION_ID,
  attempt_id: ATTEMPT_ID,
  assessment: ASSESSMENT,
  metadata: METADATA,
  recorded_at: RECORDED_AT,
  actual_state: null
};

const INPUT = {
  applicationId: APPLICATION_ID,
  attemptId: ATTEMPT_ID,
  correlationId: CORRELATION_ID,
  assessment: ASSESSMENT,
  metadata: METADATA
};

interface FakeStep {
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: string; hint: string } | null;
  readonly reject?: Error;
}

function fakeClient(step: FakeStep): {
  client: SupabaseClient;
  rpc: Array<readonly [string, unknown]>;
  eq: Array<readonly [string, unknown]>;
  from: string[];
} {
  const rpc: Array<readonly [string, unknown]> = [];
  const eq: Array<readonly [string, unknown]> = [];
  const from: string[] = [];
  const result = () =>
    step.reject ? Promise.reject(step.reject) : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      eq.push([column, value]);
      return builder;
    },
    maybeSingle: () => result()
  };
  return {
    client: {
      from: (table: string) => {
        from.push(table);
        return builder;
      },
      rpc: (name: string, params: unknown) => {
        rpc.push([name, params]);
        return result();
      }
    } as unknown as SupabaseClient,
    rpc,
    eq,
    from
  };
}

const pgError = (code: string) => ({
  code,
  message: "secret message",
  details: "secret details",
  hint: "secret hint"
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SupabaseApplicationAssessmentRepository.record", () => {
  it("calls the atomic RPC with the attempt id and correlation and returns the stored record", async () => {
    const { client, rpc } = fakeClient({ data: [RPC_ROW] });

    const result = await new SupabaseApplicationAssessmentRepository(client).record(INPUT);

    expect(rpc).toEqual([
      [
        "record_application_assessment",
        {
          p_application_id: APPLICATION_ID,
          p_attempt_id: ATTEMPT_ID,
          p_correlation_id: CORRELATION_ID,
          p_assessment: ASSESSMENT,
          p_metadata: METADATA
        }
      ]
    ]);
    expect(result).toEqual({
      ok: true,
      value: { record: { assessment: ASSESSMENT, metadata: METADATA, recordedAt: RECORDED_AT }, applied: true }
    });
  });

  it("reports a replay as applied: false with the stored record", async () => {
    const { client } = fakeClient({ data: [{ ...RPC_ROW, result_kind: "replayed" }] });

    const result = await new SupabaseApplicationAssessmentRepository(client).record(INPUT);

    expect(result).toMatchObject({ ok: true, value: { applied: false } });
  });

  it.each([
    ["not_found", { code: "not_found" }],
    ["conflict", { code: "attempt_conflict" }],
    ["something_new", { code: "unavailable" }]
  ] as const)("maps result kind %s to %j", async (kind, error) => {
    const { client } = fakeClient({ data: [{ ...RPC_ROW, result_kind: kind }] });

    expect(await new SupabaseApplicationAssessmentRepository(client).record(INPUT)).toEqual({ ok: false, error });
  });

  it("maps state_conflict with the actual state", async () => {
    const { client } = fakeClient({ data: [{ ...RPC_ROW, result_kind: "state_conflict", actual_state: "approved" }] });

    expect(await new SupabaseApplicationAssessmentRepository(client).record(INPUT)).toEqual({
      ok: false,
      error: { code: "state_conflict", actualState: "approved" }
    });
  });

  it("treats a malformed stored record as unavailable instead of widening it", async () => {
    const { client } = fakeClient({ data: [{ ...RPC_ROW, assessment: { ...ASSESSMENT, extra: 1 } }] });

    expect(await new SupabaseApplicationAssessmentRepository(client).record(INPUT)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("sanitizes a database error: no message, details or hint reach the caller", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ error: pgError("XX000") });

    const result = await new SupabaseApplicationAssessmentRepository(client).record(INPUT);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("is unavailable when the client rejects or returns no single row", async () => {
    expect(
      await new SupabaseApplicationAssessmentRepository(fakeClient({ reject: new Error("boom") }).client).record(INPUT)
    ).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(
      await new SupabaseApplicationAssessmentRepository(fakeClient({ data: [] }).client).record(INPUT)
    ).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("SupabaseApplicationAssessmentRepository.findByApplicationId", () => {
  it("reads the row by application id and returns the validated record", async () => {
    const { client, eq, from } = fakeClient({
      data: { application_id: APPLICATION_ID, assessment: ASSESSMENT, metadata: METADATA, created_at: RECORDED_AT }
    });

    const result = await new SupabaseApplicationAssessmentRepository(client).findByApplicationId(APPLICATION_ID);

    expect(from).toEqual(["application_assessment"]);
    expect(eq).toEqual([["application_id", APPLICATION_ID]]);
    expect(result).toEqual({
      ok: true,
      value: { assessment: ASSESSMENT, metadata: METADATA, recordedAt: RECORDED_AT }
    });
  });

  it("is not_found when no assessment was recorded", async () => {
    const { client } = fakeClient({ data: null });

    expect(await new SupabaseApplicationAssessmentRepository(client).findByApplicationId(APPLICATION_ID)).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("sanitizes a read error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ error: pgError("XX000") });

    expect(await new SupabaseApplicationAssessmentRepository(client).findByApplicationId(APPLICATION_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});
