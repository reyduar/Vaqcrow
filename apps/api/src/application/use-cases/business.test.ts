import { describe, expect, it, vi } from "vitest";
import type { BusinessDraft, BusinessRecord, BusinessRepositoryPort } from "../ports/business-repository-port.js";
import { createBusiness, getMyBusiness, validateBusinessDraft } from "./business.js";

const OWNER = "00000000-0000-4000-8000-000000000004";
const BUSINESS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const draft: BusinessDraft = {
  name: "Panadería Sol",
  cuit: "20123456789",
  sector: "Alimentos",
  city: "CABA",
  description: "Panadería artesanal de barrio",
  goalArs: 5_000_000,
  revenueShare: 5
};

const record: BusinessRecord = {
  ...draft,
  businessId: BUSINESS_ID,
  ownerUserId: OWNER,
  createdAt: "2026-10-03T12:00:00.000Z",
  updatedAt: "2026-10-03T12:00:00.000Z"
};

function repository(overrides: Partial<BusinessRepositoryPort> = {}): BusinessRepositoryPort {
  return {
    createForOwner: vi.fn().mockResolvedValue({ ok: true, value: record }),
    findByOwner: vi.fn().mockResolvedValue({ ok: true, value: record }),
    findOwnedById: vi.fn().mockResolvedValue({ ok: true, value: record }),
    ...overrides
  };
}

describe("validateBusinessDraft", () => {
  it("accepts a well-formed draft and normalizes the strings", () => {
    const result = validateBusinessDraft({ ...draft, name: "  Panadería Sol  " });

    expect(result).toEqual({ ok: true, value: { ...draft, name: "Panadería Sol" } });
  });

  it.each([
    ["a missing name", { ...draft, name: undefined }, { field: "name", code: "required" }],
    ["a blank name", { ...draft, name: "   " }, { field: "name", code: "required" }],
    ["a CUIT that is not 11 digits", { ...draft, cuit: "12345" }, { field: "cuit", code: "invalid_format" }],
    ["a non-numeric CUIT", { ...draft, cuit: "2012345678a" }, { field: "cuit", code: "invalid_format" }],
    ["a missing sector", { ...draft, sector: undefined }, { field: "sector", code: "required" }],
    ["a blank city", { ...draft, city: "" }, { field: "city", code: "required" }],
    ["a blank description", { ...draft, description: " " }, { field: "description", code: "required" }],
    ["a goal of zero", { ...draft, goalArs: 0 }, { field: "goalArs", code: "out_of_range" }],
    ["a negative goal", { ...draft, goalArs: -1 }, { field: "goalArs", code: "out_of_range" }],
    ["a non-integer goal", { ...draft, goalArs: 1.5 }, { field: "goalArs", code: "invalid" }],
    ["a revenue share below 1", { ...draft, revenueShare: 0 }, { field: "revenueShare", code: "out_of_range" }],
    ["a revenue share above 10", { ...draft, revenueShare: 11 }, { field: "revenueShare", code: "out_of_range" }]
  ])("rejects %s with a sanitized field error", (_name, body, expected) => {
    const result = validateBusinessDraft(body);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a rejection");
    expect(result.fieldErrors).toContainEqual(expected);
  });

  it.each([undefined, null, 42, "text", []])("rejects a non-object body (%s)", (body) => {
    expect(validateBusinessDraft(body)).toEqual({
      ok: false,
      fieldErrors: [{ field: "body", code: "invalid" }]
    });
  });

  it("rejects an unknown key as a body-level error", () => {
    expect(validateBusinessDraft({ ...draft, ownerUserId: "someone-else" })).toEqual({
      ok: false,
      fieldErrors: [{ field: "body", code: "invalid" }]
    });
  });

  it("accepts the inclusive revenue-share endpoints", () => {
    expect(validateBusinessDraft({ ...draft, revenueShare: 1 }).ok).toBe(true);
    expect(validateBusinessDraft({ ...draft, revenueShare: 10 }).ok).toBe(true);
  });

  it("accepts an optional ISO deadline and passes it through", () => {
    const deadline = "2026-12-01T00:00:00.000Z";

    expect(validateBusinessDraft({ ...draft, deadline })).toEqual({
      ok: true,
      value: { ...draft, deadline }
    });
  });

  it("leaves the deadline absent when the body does not carry one", () => {
    expect(validateBusinessDraft(draft)).toEqual({ ok: true, value: draft });
  });

  it("treats an explicit null deadline as none", () => {
    expect(validateBusinessDraft({ ...draft, deadline: null })).toEqual({ ok: true, value: draft });
  });

  it.each([
    ["a date without time or offset", "2026-12-01"],
    ["a non-ISO string", "next tuesday"],
    ["a blank string", "   "],
    ["a wrong type", 123]
  ])("rejects %s as an invalid deadline", (_name, deadline) => {
    const result = validateBusinessDraft({ ...draft, deadline });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a rejection");
    expect(result.fieldErrors).toContainEqual({ field: "deadline", code: "invalid_format" });
  });
});

describe("validateBusinessDraft campaignDurationDays (#410/U13)", () => {
  it.each([30, 60, 90])("accepts a campaign duration of %i days and passes it through", (campaignDurationDays) => {
    expect(validateBusinessDraft({ ...draft, campaignDurationDays })).toEqual({
      ok: true,
      value: { ...draft, campaignDurationDays }
    });
  });

  it("leaves the duration absent when the body carries none or an explicit null", () => {
    expect(validateBusinessDraft(draft)).toEqual({ ok: true, value: draft });
    expect(validateBusinessDraft({ ...draft, campaignDurationDays: null })).toEqual({ ok: true, value: draft });
  });

  it.each([
    ["another whole number of days", 45],
    ["zero", 0],
    ["a fractional value", 30.5],
    ["a numeric string", "30"],
    ["a wrong type", true]
  ])("rejects %s with a sanitized invalid code", (_name, campaignDurationDays) => {
    expect(validateBusinessDraft({ ...draft, campaignDurationDays })).toEqual({
      ok: false,
      fieldErrors: [{ field: "campaignDurationDays", code: "invalid" }]
    });
  });
});

describe("createBusiness", () => {
  it("creates the company for the authenticated owner, never for a body-supplied id", async () => {
    const repo = repository();

    const result = await createBusiness(
      { repository: repo },
      { ownerUserId: OWNER, body: { ...draft, ownerUserId: "attacker" } }
    );

    // The attacker-shaped body is refused before the repository is called.
    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_request", fieldErrors: [{ field: "body", code: "invalid" }] }
    });
    expect(repo.createForOwner).not.toHaveBeenCalled();
  });

  it("passes the principal's owner id and the validated draft to the repository", async () => {
    const repo = repository();

    const result = await createBusiness({ repository: repo }, { ownerUserId: OWNER, body: draft });

    expect(repo.createForOwner).toHaveBeenCalledWith({ ownerUserId: OWNER, draft });
    expect(result).toEqual({ ok: true, value: record });
  });

  it("passes an optional deadline through to the repository", async () => {
    const repo = repository();
    const deadline = "2026-12-01T00:00:00.000Z";

    const result = await createBusiness(
      { repository: repo },
      { ownerUserId: OWNER, body: { ...draft, deadline } }
    );

    expect(repo.createForOwner).toHaveBeenCalledWith({ ownerUserId: OWNER, draft: { ...draft, deadline } });
    expect(result).toEqual({ ok: true, value: record });
  });

  it("never persists an invalid body", async () => {
    const repo = repository();

    const result = await createBusiness({ repository: repo }, { ownerUserId: OWNER, body: { ...draft, goalArs: 0 } });

    expect(repo.createForOwner).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: { code: "invalid_request", fieldErrors: [{ field: "goalArs", code: "out_of_range" }] }
    });
  });

  it("maps a repository invalid_request to an empty field-error envelope and never leaks text", async () => {
    const repo = repository({
      createForOwner: vi.fn().mockResolvedValue({ ok: false, error: { code: "invalid_request" } })
    });

    expect(await createBusiness({ repository: repo }, { ownerUserId: OWNER, body: draft })).toEqual({
      ok: false,
      error: { code: "invalid_request", fieldErrors: [] }
    });
  });

  it.each(["unavailable", "not_found"] as const)("maps repository %s to unavailable", async (code) => {
    const repo = repository({ createForOwner: vi.fn().mockResolvedValue({ ok: false, error: { code } }) });

    expect(await createBusiness({ repository: repo }, { ownerUserId: OWNER, body: draft })).toEqual({
      ok: false,
      error: { code: "unavailable", fieldErrors: [] }
    });
  });
});

describe("getMyBusiness", () => {
  it("returns the caller's own company", async () => {
    const repo = repository();

    expect(await getMyBusiness({ repository: repo }, { ownerUserId: OWNER })).toEqual({ ok: true, value: record });
    expect(repo.findByOwner).toHaveBeenCalledWith(OWNER);
  });

  it("is not_found when the caller has no company yet", async () => {
    const repo = repository({ findByOwner: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) });

    expect(await getMyBusiness({ repository: repo }, { ownerUserId: OWNER })).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("is unavailable on a repository failure", async () => {
    const repo = repository({ findByOwner: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });

    expect(await getMyBusiness({ repository: repo }, { ownerUserId: OWNER })).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});
