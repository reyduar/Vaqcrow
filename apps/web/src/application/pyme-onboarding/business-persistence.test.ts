import { describe, expect, it } from "vitest";
import type { BusinessDraft } from "@/application/ports/business-port";
import { DEMO_VALUES } from "./registration-step";
import { businessDraftFromRegistration, ensureMyBusiness } from "./business-persistence";
import { FakeBusiness, fakeBusinessRecord } from "@/test/fake-business";

const DRAFT: BusinessDraft = {
  name: "Panadería Horizonte SRL",
  cuit: "30712345678",
  sector: "Alimentos",
  city: "Córdoba",
  description: DEMO_VALUES.desc,
  goalArs: 15000000,
  revenueShare: 4.5,
  campaignDurationDays: 60
};

describe("businessDraftFromRegistration", () => {
  it("maps the wizard's strings onto the API's draft shape", () => {
    expect(businessDraftFromRegistration(DEMO_VALUES)).toEqual(DRAFT);
  });

  it("sends the CUIT as eleven digits and never an owner", () => {
    const draft = businessDraftFromRegistration({ ...DEMO_VALUES, cuit: "30-71234567-8" });

    expect(draft.cuit).toBe("30712345678");
    expect(Object.keys(draft)).not.toContain("ownerUserId");
    expect(Object.keys(draft)).not.toContain("owner_user_id");
    expect(Object.keys(draft)).toHaveLength(8);
  });

  it("sends the chosen campaign duration as whole days (#410/U13)", () => {
    expect(businessDraftFromRegistration({ ...DEMO_VALUES, duration: "30" }).campaignDurationDays).toBe(30);
    expect(businessDraftFromRegistration({ ...DEMO_VALUES, duration: "90" }).campaignDurationDays).toBe(90);
  });
});

describe("ensureMyBusiness", () => {
  it("reuses an existing company without creating another", async () => {
    const existing = fakeBusinessRecord(DRAFT);
    const business = new FakeBusiness(existing);

    expect(await ensureMyBusiness(business, DEMO_VALUES)).toEqual({
      ok: true,
      business: existing,
      created: false
    });
    expect(business.getCalls).toBe(1);
    expect(business.creates).toHaveLength(0);
  });

  it("creates the mapped company when the owner has none", async () => {
    const business = new FakeBusiness();

    const result = await ensureMyBusiness(business, DEMO_VALUES);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect(business.creates).toEqual([DRAFT]);
    expect(result.business.businessId).toBeTruthy();
  });

  it("does not create when reading the company fails for another reason", async () => {
    const business = new FakeBusiness();
    business.failNext("get", "unavailable");

    expect(await ensureMyBusiness(business, DEMO_VALUES)).toEqual({ ok: false, code: "unavailable" });
    expect(business.creates).toHaveLength(0);
  });

  it("propagates a sanitized code when creation fails", async () => {
    const business = new FakeBusiness();
    business.failNext("create", "invalid_request");

    expect(await ensureMyBusiness(business, DEMO_VALUES)).toEqual({ ok: false, code: "invalid_request" });
  });
});
