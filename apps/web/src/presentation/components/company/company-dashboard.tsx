"use client";

import { useState } from "react";
import { MY_CAMPAIGNS_COPY } from "@/application/company/copy";
import { sortMyCampaigns, type MyCampaignSortMode } from "@/application/company/sort";
import type {
  MyCampaign,
  MyCampaignDistribution,
  MyCampaignsPort
} from "@/application/ports/my-campaigns-port";
import { createBrowserMyCampaignsPort } from "@/infrastructure/company/create-my-campaigns-port";
import { useMyCampaigns } from "@/state/use-my-campaigns";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import { Skeleton } from "../skeleton";
import { CompanyDistributions } from "./company-distributions";
import { CompanySalesChart } from "./company-sales-chart";
import { CompanyStats } from "./company-stats";
import { CompanyVaultList } from "./company-vault-list";

/**
 * The PyME «Mi campaña» dashboard body (Feature #434, WU2). It owns the SWR
 * read and the sort state; the sections are presentational and the pure
 * mappings live in `application/company/`. The `Mi campaña` heading, the wallet
 * card, «Registrar mi PyME» and the onboarding wizard stay in
 * `company-workspace.tsx`, which mounts this container.
 *
 * The states are honest: a loading skeleton, a retryable error on a failed
 * read, and an empty state while the PyME has no campaign yet (before any vault
 * is deployed). A `null` port (no configured backend) fails closed to the error
 * state rather than inventing an empty dashboard.
 *
 * Scope is read-only: the `Declarar ventas` (WU3) and `Revisar y firmar` (WU4)
 * slots are rendered but unwired here — the handlers are the injectable seam
 * those units will use; without them the actions render disabled.
 */
export interface CompanyDashboardProps {
  readonly port: MyCampaignsPort | null;
  /** WU3 slot; while omitted the declare action renders disabled. */
  readonly onDeclareSales?: (campaign: MyCampaign) => void;
  /** WU4 slot; while omitted the signing action renders disabled. */
  readonly onReviewAndSign?: (campaign: MyCampaign, distribution: MyCampaignDistribution) => void;
}

export function CompanyDashboard({ port, onDeclareSales, onReviewAndSign }: CompanyDashboardProps) {
  const [sort, setSort] = useState<MyCampaignSortMode>("recent");
  const state = useMyCampaigns(port, true);

  if (state.isLoading) {
    return <Skeleton shapes={["card", "line", "line"]} label={MY_CAMPAIGNS_COPY.loadingLabel} />;
  }

  if (state.loadFailed || state.data === null) {
    return (
      <ErrorState
        title={MY_CAMPAIGNS_COPY.errorTitle}
        message={MY_CAMPAIGNS_COPY.errorMessage}
        onRetry={state.reload}
        retryLabel={MY_CAMPAIGNS_COPY.retryLabel}
      />
    );
  }

  const campaigns = state.data.campaigns;

  if (campaigns.length === 0) {
    return <EmptyState title={MY_CAMPAIGNS_COPY.emptyTitle} body={MY_CAMPAIGNS_COPY.emptyBody} />;
  }

  const sorted = sortMyCampaigns(campaigns, sort);
  const campaignsWithSales = campaigns.filter((campaign) => campaign.sales.length > 0);

  return (
    <div className="flex flex-col gap-10">
      <CompanyStats campaigns={campaigns} />

      <CompanyVaultList
        campaigns={sorted}
        sort={sort}
        onSortChange={setSort}
        {...(onDeclareSales ? { onDeclareSales } : {})}
        {...(onReviewAndSign ? { onReviewAndSign } : {})}
      />

      {campaignsWithSales.length > 0 ? (
        <div className="flex flex-col gap-6">
          {campaignsWithSales.map((campaign) => (
            <CompanySalesChart key={campaign.campaignId} campaign={campaign} />
          ))}
        </div>
      ) : null}

      <CompanyDistributions campaigns={campaigns} />
    </div>
  );
}

export interface CompanyDashboardContainerProps {
  /** Injectable for tests; production builds the browser port once. */
  readonly port?: MyCampaignsPort | null;
  readonly onDeclareSales?: (campaign: MyCampaign) => void;
  readonly onReviewAndSign?: (campaign: MyCampaign, distribution: MyCampaignDistribution) => void;
}

/** The browser-wired entry point: `company-workspace.tsx` mounts this. */
export function CompanyDashboardContainer({ port, onDeclareSales, onReviewAndSign }: CompanyDashboardContainerProps) {
  const [resolved] = useState<MyCampaignsPort | null>(() =>
    port === undefined ? createBrowserMyCampaignsPort() : port
  );

  return (
    <CompanyDashboard
      port={resolved}
      {...(onDeclareSales ? { onDeclareSales } : {})}
      {...(onReviewAndSign ? { onReviewAndSign } : {})}
    />
  );
}
