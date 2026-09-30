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
