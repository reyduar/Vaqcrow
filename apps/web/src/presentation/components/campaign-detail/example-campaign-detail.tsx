"use client";

import { EXAMPLE_CAMPAIGN_COPY, EXAMPLE_CAMPAIGN_DETAIL } from "@/application/campaign/example-campaign";
import { CampaignDetailView } from "./campaign-detail-view";

/**
 * The synthetic campaign detail (Issue #481). It reuses the real
 * `CampaignDetailView` so the example and a live campaign render identically,
 * and passes `role={null}`: with no verified investor role the shared view
 * never mounts the contribution or withdraw flows, so there is no dead action
 * and nothing to call the API or Stellar.
 *
 * The banner and the trailing note are the only additions around the shared
 * view; they state that the page is an example and that contributing is not
 * available here.
 */
export function ExampleCampaignDetail() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 rounded-card border border-dashed border-border bg-page-surface p-5">
        <h2 className="m-0 text-lg font-bold">{EXAMPLE_CAMPAIGN_COPY.title}</h2>
        <p className="m-0 text-sm leading-relaxed text-text-secondary">{EXAMPLE_CAMPAIGN_COPY.body}</p>
      </div>

      <CampaignDetailView detail={EXAMPLE_CAMPAIGN_DETAIL} role={null} />

      <p className="m-0 text-sm leading-relaxed text-text-secondary">{EXAMPLE_CAMPAIGN_COPY.actionsNote}</p>
    </div>
  );
}
