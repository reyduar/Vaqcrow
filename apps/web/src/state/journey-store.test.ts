import { describe, expect, it } from "vitest";
import { createJourneyStore } from "./journey-store";

describe("createJourneyStore", () => {
  it("starts empty", () => {
    expect(createJourneyStore().getState()).toMatchObject({
      applicationId: null,
      campaignId: null,
      distributionId: null
    });
  });

  it("accepts initial identifiers", () => {
    const store = createJourneyStore({ applicationId: "app-1" });
    expect(store.getState().applicationId).toBe("app-1");
    expect(store.getState().campaignId).toBeNull();
  });

  describe("initial identifiers (T1-F)", () => {
    it("trims them exactly like the record actions", () => {
      const store = createJourneyStore({ applicationId: "  app-1 ", campaignId: " c ", distributionId: " d " });
      expect(store.getState()).toMatchObject({ applicationId: "app-1", campaignId: "c", distributionId: "d" });
    });

    it.each(["", "   "])("rejects a blank initial identifier %j", (bad) => {
      expect(() => createJourneyStore({ applicationId: bad })).toThrow(/non-empty/);
      expect(() => createJourneyStore({ applicationId: "a", campaignId: bad })).toThrow(/non-empty/);
      expect(() => createJourneyStore({ applicationId: "a", campaignId: "c", distributionId: bad })).toThrow(
        /non-empty/
      );
    });

    it("rejects a campaign without an application and a distribution without a campaign", () => {
      expect(() => createJourneyStore({ campaignId: "c" })).toThrow(/application/i);
      expect(() => createJourneyStore({ applicationId: "a", distributionId: "d" })).toThrow(/campaign/i);
    });

    it("treats explicit nulls as absent", () => {
      expect(createJourneyStore({ applicationId: null, campaignId: null }).getState()).toMatchObject({
        applicationId: null,
        campaignId: null
      });
    });
  });

  describe("parentless writes (T1-F)", () => {
    it("recordCampaign without an application throws and leaves state untouched", () => {
      const store = createJourneyStore();
      expect(() => store.getState().recordCampaign("c")).toThrow(/application/i);
      expect(store.getState().campaignId).toBeNull();
    });

    it("recordDistribution without a campaign throws and leaves state untouched", () => {
      const store = createJourneyStore({ applicationId: "a" });
      expect(() => store.getState().recordDistribution("d")).toThrow(/campaign/i);
      expect(store.getState().distributionId).toBeNull();
    });
  });

  it("records and trims identifiers", () => {
    const store = createJourneyStore();
    store.getState().recordApplication("  app-1 ");
    store.getState().recordCampaign("camp-1");
    store.getState().recordDistribution("dist-1");
    expect(store.getState()).toMatchObject({
      applicationId: "app-1",
      campaignId: "camp-1",
      distributionId: "dist-1"
    });
  });

  it("clears downstream ids when a different application is recorded", () => {
    const store = createJourneyStore({ applicationId: "app-1", campaignId: "c", distributionId: "d" });
    store.getState().recordApplication("app-2");
    expect(store.getState()).toMatchObject({ applicationId: "app-2", campaignId: null, distributionId: null });
  });

  it("keeps downstream ids when the same application is re-recorded", () => {
    const store = createJourneyStore({ applicationId: "app-1", campaignId: "c", distributionId: "d" });
    store.getState().recordApplication(" app-1 ");
    expect(store.getState()).toMatchObject({ applicationId: "app-1", campaignId: "c", distributionId: "d" });
  });

  it("clears the distribution when a different campaign is recorded, keeps it for the same one", () => {
    const store = createJourneyStore({ applicationId: "a", campaignId: "c1", distributionId: "d" });
    store.getState().recordCampaign("c1");
    expect(store.getState().distributionId).toBe("d");
    store.getState().recordCampaign("c2");
    expect(store.getState()).toMatchObject({ campaignId: "c2", distributionId: null });
  });

  it.each(["", "   "])("throws on empty identifier %j and leaves state untouched", (bad) => {
    const store = createJourneyStore({ applicationId: "a" });
    expect(() => store.getState().recordApplication(bad)).toThrow();
    expect(() => store.getState().recordCampaign(bad)).toThrow();
    expect(() => store.getState().recordDistribution(bad)).toThrow();
    expect(store.getState().applicationId).toBe("a");
    expect(store.getState().campaignId).toBeNull();
  });

  it("reset clears everything", () => {
    const store = createJourneyStore({ applicationId: "a", campaignId: "c", distributionId: "d" });
    store.getState().reset();
    expect(store.getState()).toMatchObject({ applicationId: null, campaignId: null, distributionId: null });
  });

  it("isolates separate stores", () => {
    const a = createJourneyStore();
    const b = createJourneyStore();
    a.getState().recordApplication("x");
    expect(b.getState().applicationId).toBeNull();
  });
});
