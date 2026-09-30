import { describe, expect, it } from "vitest";
import {
  journeyStepHref,
  mergeJourneyParams,
  parseJourneyParams,
  serializeJourneyParams
} from "./journey-params";

const APP = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const CAMPAIGN = "40000000-0000-4000-8000-000000000000";
const DISTRIBUTION = "223e4567-e89b-42d3-a456-4266141740ab";

const search = (query: string) => new URLSearchParams(query);

describe("parseJourneyParams", () => {
  it("reads the three identifiers", () => {
    expect(
      parseJourneyParams(search(`application=${APP}&campaign=${CAMPAIGN}&distribution=${DISTRIBUTION}`))
    ).toEqual({ applicationId: APP, campaignId: CAMPAIGN, distributionId: DISTRIBUTION });
  });

  it("answers null for every absent identifier", () => {
    expect(parseJourneyParams(search(""))).toEqual({
      applicationId: null,
      campaignId: null,
      distributionId: null
    });
  });

  it("trims a value and ignores blank or non-uuid values", () => {
    expect(parseJourneyParams(search(`application=%20${APP}%20`)).applicationId).toBe(APP);
    for (const bad of ["", "   ", "app-1", "not-a-uuid", `${APP}x`, "<script>"]) {
      expect(parseJourneyParams(search(`application=${encodeURIComponent(bad)}`)).applicationId).toBeNull();
    }
  });

  it("ignores a campaign without an application", () => {
    expect(parseJourneyParams(search(`campaign=${CAMPAIGN}`))).toEqual({
      applicationId: null,
      campaignId: null,
      distributionId: null
    });
  });

  it("ignores a distribution without a campaign, and cascades from an invalid campaign", () => {
    expect(parseJourneyParams(search(`application=${APP}&distribution=${DISTRIBUTION}`))).toEqual({
      applicationId: APP,
      campaignId: null,
      distributionId: null
    });
    expect(
      parseJourneyParams(search(`application=${APP}&campaign=nope&distribution=${DISTRIBUTION}`))
    ).toMatchObject({ applicationId: APP, campaignId: null, distributionId: null });
  });
});

describe("serializeJourneyParams", () => {
  it("serializes only the present identifiers", () => {
    expect(serializeJourneyParams({ applicationId: APP, campaignId: null, distributionId: null })).toBe(
      `application=${APP}`
    );
    expect(serializeJourneyParams({ applicationId: null, campaignId: null, distributionId: null })).toBe("");
  });

  it("drops an identifier whose parent is missing", () => {
    expect(serializeJourneyParams({ applicationId: null, campaignId: CAMPAIGN, distributionId: null })).toBe("");
    expect(
      serializeJourneyParams({ applicationId: APP, campaignId: null, distributionId: DISTRIBUTION })
    ).toBe(`application=${APP}`);
  });

  it("round-trips through parse", () => {
    const ids = { applicationId: APP, campaignId: CAMPAIGN, distributionId: DISTRIBUTION };
    expect(parseJourneyParams(search(serializeJourneyParams(ids)))).toEqual(ids);
  });
});

describe("mergeJourneyParams", () => {
  it("keeps unrelated params, sets present ids and removes absent ones", () => {
    const merged = mergeJourneyParams(search(`foo=bar&campaign=${CAMPAIGN}`), {
      applicationId: APP,
      campaignId: null,
      distributionId: null
    });
    expect(merged.get("foo")).toBe("bar");
    expect(merged.get("application")).toBe(APP);
    expect(merged.has("campaign")).toBe(false);
  });

  it("does not mutate its input", () => {
    const input = search("foo=bar");
    mergeJourneyParams(input, { applicationId: APP, campaignId: null, distributionId: null });
    expect(input.toString()).toBe("foo=bar");
  });
});

describe("journeyStepHref", () => {
  it("is the plain step path when the journey has no identifiers", () => {
    expect(journeyStepHref("approval", { applicationId: null, campaignId: null, distributionId: null })).toBe(
      "/approval"
    );
  });

  it("appends the present identifiers", () => {
    expect(
      journeyStepHref("evidence", { applicationId: APP, campaignId: CAMPAIGN, distributionId: null })
    ).toBe(`/evidence?application=${APP}&campaign=${CAMPAIGN}`);
  });
});
