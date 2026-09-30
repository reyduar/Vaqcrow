import { demoStepHref, type DemoStepSlug } from "./demo-steps";

/**
 * The journey identifiers as they travel in the URL. The URL is the durable
 * carrier (a reload or a shared link resumes the same journey); the client
 * store is the in-session source. Pure and React-free.
 */
export interface JourneyIdSet {
  readonly applicationId: string | null;
  readonly campaignId: string | null;
  readonly distributionId: string | null;
}

export const journeyParamNames = Object.freeze({
  applicationId: "application",
  campaignId: "campaign",
  distributionId: "distribution"
} as const);

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readId(params: { get(name: string): string | null }, name: string): string | null {
  const trimmed = params.get(name)?.trim() ?? "";
  return UUID_SHAPE.test(trimmed) ? trimmed : null;
}

/** Enforces the hierarchy: a campaign needs an application, a distribution needs a campaign. */
function withHierarchy(ids: JourneyIdSet): JourneyIdSet {
  const applicationId = ids.applicationId;
  const campaignId = applicationId === null ? null : ids.campaignId;
  const distributionId = campaignId === null ? null : ids.distributionId;
  return { applicationId, campaignId, distributionId };
}

/** Reads the journey ids from search params; invalid, blank or orphaned values are ignored. */
export function parseJourneyParams(params: { get(name: string): string | null }): JourneyIdSet {
  return withHierarchy({
    applicationId: readId(params, journeyParamNames.applicationId),
    campaignId: readId(params, journeyParamNames.campaignId),
    distributionId: readId(params, journeyParamNames.distributionId)
  });
}

/** Sets the present ids on a copy of `current` and removes the absent ones; other params are kept. */
export function mergeJourneyParams(current: URLSearchParams, ids: JourneyIdSet): URLSearchParams {
  const merged = new URLSearchParams(current);
  const effective = withHierarchy(ids);
  for (const key of Object.keys(journeyParamNames) as (keyof JourneyIdSet)[]) {
    const value = effective[key];
    if (value === null) merged.delete(journeyParamNames[key]);
    else merged.set(journeyParamNames[key], value);
  }
  return merged;
}

/** The query string (no leading `?`) carrying only the present journey ids. */
export function serializeJourneyParams(ids: JourneyIdSet): string {
  return mergeJourneyParams(new URLSearchParams(), ids).toString();
}

/** A step link that carries the journey ids. */
export function journeyStepHref(slug: DemoStepSlug, ids: JourneyIdSet): string {
  const query = serializeJourneyParams(ids);
  return query === "" ? demoStepHref(slug) : `${demoStepHref(slug)}?${query}`;
}
