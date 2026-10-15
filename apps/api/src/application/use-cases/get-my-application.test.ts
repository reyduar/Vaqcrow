import { describe, expect, it, vi } from "vitest";
import { parseApplicationId } from "@vaqcrow/contracts";
import type { ApplicationId } from "@vaqcrow/contracts";
import type { SmeRequestRecord, SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";
import { getMyApplication } from "./get-my-application.js";

/**
 * `getMyApplication` (#530/T1): the owner's own latest application and its real
 * review state, resolved from the verified owner only. A repository failure is
 * `unavailable`, never an invented state.
 */
const OWNER = "00000000-0000-4000-8000-000000000004";
const APPLICATION_ID = parseApplicationId("123e4567-e89b-42d3-a456-426614174000");
const OLDER_ID = parseApplicationId("223e4567-e89b-42d3-a456-426614174000");

const REQUEST = {
  smeReference: "SM-1",
  declaredTotalArs: 1000,
  periodStart: "2026-01",
  periodEnd: "2026-06",
  simuladoLabel: "SIMULADO" as const
};

function record(applicationId: ApplicationId): SmeRequestRecord {
  return { applicationId, request: REQUEST, ownerUserId: OWNER };
}

function deps(
  overrides: {
    readonly findByOwner?: SmeRequestRepositoryPort["findByOwner"];
    readonly findReviewStateByApplicationId?: SmeRequestRepositoryPort["findReviewStateByApplicationId"];
  } = {}
) {
  return {
    repository: {
      findByOwner: overrides.findByOwner ?? (async () => ({ ok: true as const, value: [] })),
      findReviewStateByApplicationId:
        overrides.findReviewStateByApplicationId ??
        (async () => ({ ok: true as const, value: "human_review" as const }))
    }
  };
}

describe("getMyApplication", () => {
  it("returns the owner's own application with its real state, scoped to that owner", async () => {
    const findByOwner = vi.fn(async () => ({ ok: true as const, value: [record(APPLICATION_ID)] }));

    const result = await getMyApplication(
      deps({
        findByOwner,
        findReviewStateByApplicationId: async () => ({ ok: true as const, value: "human_review" })
      }),
      { ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, state: "human_review" } });
    expect(findByOwner).toHaveBeenCalledWith(OWNER);
  });

  it("resolves the state of the newest application when the owner has more than one", async () => {
    const result = await getMyApplication(
      deps({
        findByOwner: async () => ({ ok: true as const, value: [record(APPLICATION_ID), record(OLDER_ID)] }),
        findReviewStateByApplicationId: async () => ({ ok: true as const, value: "approved" })
      }),
      { ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: true, value: { applicationId: APPLICATION_ID, state: "approved" } });
  });

  it("returns null when the owner has no application", async () => {
    const result = await getMyApplication(deps(), { ownerUserId: OWNER });

    expect(result).toEqual({ ok: true, value: null });
  });

  it("is unavailable when the owner read fails", async () => {
    const result = await getMyApplication(
      deps({ findByOwner: async () => ({ ok: false as const, error: { code: "unavailable" as const } }) }),
      { ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("is unavailable when the state cannot be resolved", async () => {
    const result = await getMyApplication(
      deps({
        findByOwner: async () => ({ ok: true as const, value: [record(APPLICATION_ID)] }),
        findReviewStateByApplicationId: async () => ({ ok: false as const, error: { code: "not_found" as const } })
      }),
      { ownerUserId: OWNER }
    );

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});
