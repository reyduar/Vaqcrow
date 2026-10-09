"use client";

import { useCallback, useState } from "react";
import { MY_CAMPAIGNS_COPY } from "@/application/company/copy";
import { sortMyCampaigns, type MyCampaignSortMode } from "@/application/company/sort";
import type { BusinessPort } from "@/application/ports/business-port";
import type {
  MyCampaign,
  MyCampaignDistribution,
  MyCampaignsPort
} from "@/application/ports/my-campaigns-port";
import type { RevenueShareDistributionGateway } from "@/application/ports/revenue-share-distribution-gateway";
import type { SalesDeclarationPort } from "@/application/ports/sales-declaration-port";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { createBrowserBusinessPort } from "@/infrastructure/business/create-business-port";
import { createCampaignGateway } from "@/infrastructure/campaign/default-gateway";
import { createBrowserMyCampaignsPort } from "@/infrastructure/company/create-my-campaigns-port";
import { createBrowserSalesDeclarationPort } from "@/infrastructure/company/create-sales-declaration-port";
import { useMyCampaigns } from "@/state/use-my-campaigns";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import { Skeleton } from "../skeleton";
import { CompanyDeclareSales } from "./company-declare-sales";
import { CompanyDistributions } from "./company-distributions";
import { CompanySalesChart } from "./company-sales-chart";
import { CompanySignDistribution } from "./company-sign-distribution";
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
 * WU3 wires the `Declarar ventas` slot: when a declaration port and a business
 * port are present the action opens `CompanyDeclareSales`, whose successful
 * submit reloads this dashboard. WU4 wires the `Revisar y firmar` slot: when an
 * application resolver is present the row action opens `CompanySignDistribution`
 * for that distribution, reusing the shipped prepare → review → Freighter →
 * submit flow, and reloads the dashboard on success.
 */
export interface CompanyDashboardProps {
  readonly port: MyCampaignsPort | null;
  /** WU3 declaration gateway; when present the declare action opens the panel. */
  readonly declarePort?: SalesDeclarationPort | null;
  /** WU3 business resolver; required alongside `declarePort` to open the panel. */
  readonly business?: BusinessPort | null;
  /** WU3 override; when provided it replaces the internal declare panel. */
  readonly onDeclareSales?: (campaign: MyCampaign) => void;
  /** WU4 override; when provided it replaces the internal signing action. */
  readonly onReviewAndSign?: (campaign: MyCampaign, distribution: MyCampaignDistribution) => void;
  /**
   * WU4: resolves a campaign's application identity (the my-campaigns read
   * model does not carry it). When present the signing action is wired; when
   * absent the slot renders disabled with an honest reason.
   */
  readonly resolveApplicationId?: (campaignId: string) => Promise<string | null>;
  /** WU4 injectable distribution port; `undefined` uses the component's browser default. */
  readonly distributionGateway?: RevenueShareDistributionGateway | null;
  /** WU4 injectable wallet; `undefined` uses the component's Freighter default. */
  readonly wallet?: WalletPort;
  /** WU4 injectable persisted-connection read; `undefined` uses the browser default. */
  readonly connection?: WalletConnectionPort | null;
}

export function CompanyDashboard({
  port,
  declarePort,
  business,
  onDeclareSales,
  onReviewAndSign,
  resolveApplicationId,
  distributionGateway,
  wallet,
  connection
}: CompanyDashboardProps) {
  const [sort, setSort] = useState<MyCampaignSortMode>("recent");
  const [declaring, setDeclaring] = useState<MyCampaign | null>(null);
  const [signing, setSigning] = useState<{ campaign: MyCampaign; distribution: MyCampaignDistribution } | null>(null);
  const [signingApplicationId, setSigningApplicationId] = useState<string | null>(null);
  const [signingResolveFailed, setSigningResolveFailed] = useState(false);
  const state = useMyCampaigns(port, true);

  const openSigning = useCallback(
    (campaign: MyCampaign, distribution: MyCampaignDistribution) => {
      if (!resolveApplicationId) return;
      setSigning({ campaign, distribution });
      setSigningApplicationId(null);
      setSigningResolveFailed(false);
      void resolveApplicationId(campaign.campaignId).then(
        (id) => {
          if (id === null) setSigningResolveFailed(true);
          else setSigningApplicationId(id);
        },
        () => setSigningResolveFailed(true)
      );
    },
    [resolveApplicationId]
  );

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

  const canWireDeclare = declarePort !== undefined && declarePort !== null && business !== undefined && business !== null;
  const declareHandler = onDeclareSales ?? (canWireDeclare ? (campaign: MyCampaign) => setDeclaring(campaign) : undefined);

  const canWireSign = resolveApplicationId !== undefined;
  const signHandler = onReviewAndSign ?? (canWireSign ? openSigning : undefined);

  const sorted = sortMyCampaigns(campaigns, sort);
  const campaignsWithSales = campaigns.filter((campaign) => campaign.sales.length > 0);

  return (
    <div className="flex flex-col gap-10">
      <CompanyStats campaigns={campaigns} />

      <CompanyVaultList
        campaigns={sorted}
        sort={sort}
        onSortChange={setSort}
        {...(declareHandler ? { onDeclareSales: declareHandler } : {})}
        {...(signHandler ? { onReviewAndSign: signHandler } : {})}
      />

      {declaring !== null && declarePort !== undefined && declarePort !== null && business !== undefined && business !== null ? (
        <CompanyDeclareSales
          key={declaring.campaignId}
          campaign={declaring}
          port={declarePort}
          business={business}
          onSubmitted={state.reload}
          onCancel={() => setDeclaring(null)}
        />
      ) : null}

      {signing !== null && signingApplicationId !== null ? (
        <CompanySignDistribution
          key={signing.distribution.distributionId}
          campaign={signing.campaign}
          distribution={signing.distribution}
          applicationId={signingApplicationId}
          onSigned={state.reload}
          onCancel={() => {
            setSigning(null);
            setSigningApplicationId(null);
            setSigningResolveFailed(false);
          }}
          autoStart
          {...(distributionGateway !== undefined ? { gateway: distributionGateway } : {})}
          {...(wallet !== undefined ? { wallet } : {})}
          {...(connection !== undefined ? { connection } : {})}
        />
      ) : null}

      {signing !== null && signingResolveFailed ? (
        <p role="alert" className="m-0 text-sm text-trust-critical">
          No pudimos identificar la solicitud de esta campaña, así que no se puede preparar la firma. Recargá el tablero.
        </p>
      ) : null}

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
  /** Injectable for tests; production builds the browser declaration port. */
  readonly declarePort?: SalesDeclarationPort | null;
  /** Injectable for tests; production builds the browser business port. */
  readonly business?: BusinessPort | null;
  readonly onDeclareSales?: (campaign: MyCampaign) => void;
  readonly onReviewAndSign?: (campaign: MyCampaign, distribution: MyCampaignDistribution) => void;
  /** Injectable for tests; production resolves the campaign's application via the campaign gateway. */
  readonly resolveApplicationId?: (campaignId: string) => Promise<string | null>;
  /** Injectable for tests; production uses the component's browser default. */
  readonly distributionGateway?: RevenueShareDistributionGateway | null;
  readonly wallet?: WalletPort;
  readonly connection?: WalletConnectionPort | null;
}

/** The browser-wired entry point: `company-workspace.tsx` mounts this. */
export function CompanyDashboardContainer({
  port,
  declarePort,
  business,
  onDeclareSales,
  onReviewAndSign,
  resolveApplicationId,
  distributionGateway,
  wallet,
  connection
}: CompanyDashboardContainerProps) {
  const [resolved] = useState<MyCampaignsPort | null>(() =>
    port === undefined ? createBrowserMyCampaignsPort() : port
  );
  const [resolvedDeclare] = useState<SalesDeclarationPort | null>(() =>
    declarePort === undefined ? createBrowserSalesDeclarationPort() : declarePort
  );
  const [resolvedBusiness] = useState<BusinessPort | null>(() =>
    business === undefined ? createBrowserBusinessPort() : business
  );
  // The my-campaigns read model carries no application id, and `POST
  // /revenue-share-distributions` needs the case it derives for. The campaign
  // snapshot (`GET /campaigns/:campaignId`) exposes it, so the container
  // resolves it lazily per campaign and never guesses.
  const [campaignGateway] = useState(() =>
    createCampaignGateway(process.env["NEXT_PUBLIC_API_BASE_URL"])
  );
  const defaultResolveApplicationId = useCallback(
    async (campaignId: string): Promise<string | null> => {
      if (!campaignGateway) return null;
      try {
        const snapshot = await campaignGateway.getCampaign(campaignId);
        return snapshot.applicationId;
      } catch {
        return null;
      }
    },
    [campaignGateway]
  );

  return (
    <CompanyDashboard
      port={resolved}
      declarePort={resolvedDeclare}
      business={resolvedBusiness}
      resolveApplicationId={resolveApplicationId ?? defaultResolveApplicationId}
      {...(onDeclareSales ? { onDeclareSales } : {})}
      {...(onReviewAndSign ? { onReviewAndSign } : {})}
      {...(distributionGateway !== undefined ? { distributionGateway } : {})}
      {...(wallet !== undefined ? { wallet } : {})}
      {...(connection !== undefined ? { connection } : {})}
    />
  );
}
