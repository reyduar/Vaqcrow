"use client";

import { MY_CAMPAIGN_STATE_TONE, vaultStatusTitle, type CampaignStateTone } from "@/application/company/campaign-state";
import { MY_CAMPAIGNS_COPY } from "@/application/company/copy";
import { needsSignature, toDistributionRow } from "@/application/company/distributions";
import { formatArsAmount, formatShortAddress } from "@/application/company/format";
import type { MyCampaignSortMode } from "@/application/company/sort";
import type { MyCampaign, MyCampaignDistribution } from "@/application/ports/my-campaigns-port";
import { Badge } from "../badge";
import { Button } from "../button";
import { ProgressBar } from "../progress-bar";

/**
 * «Bóveda y distribuciones» (`Vaqcrow Portafolio.dc.html`, PyME mode; Feature
 * #434, WU2). Presentational: the campaigns arrive sorted and every value is
 * already formatted by `application/company/`.
 *
 * One row per campaign: name, abbreviated vault address, state joined with the
 * contributor count, the funding progress and the contract's immutability note.
 * Its distributions are nested (period, ARS principal plus the approximate XLM,
 * state) and a `Revisar y firmar` slot is offered only for a `submitted`
 * distribution. The `Declarar ventas` (WU3) and `Revisar y firmar` (WU4) slots
 * are present but unwired here: without a handler they render disabled with an
 * honest reason, so the affordance is visible without pretending it acts.
 */

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const TONE_BLOCK: Readonly<Record<CampaignStateTone, string>> = {
  info: "bg-trust-info-surface text-trust-info",
  neutral: "bg-page-surface text-text-secondary",
  caution: "bg-trust-caution-surface text-trust-caution"
};

const SORT_OPTIONS: readonly { readonly id: MyCampaignSortMode; readonly label: string }[] = [
  { id: "recent", label: MY_CAMPAIGNS_COPY.sortRecent },
  { id: "state", label: MY_CAMPAIGNS_COPY.sortByState }
];

export interface CompanyVaultListProps {
  readonly campaigns: readonly MyCampaign[];
  readonly sort: MyCampaignSortMode;
  readonly onSortChange: (mode: MyCampaignSortMode) => void;
  /** WU3 slot; while omitted the action renders disabled. */
  readonly onDeclareSales?: (campaign: MyCampaign) => void;
  /** WU4 slot; while omitted the action renders disabled. */
  readonly onReviewAndSign?: (campaign: MyCampaign, distribution: MyCampaignDistribution) => void;
}

function DistributionRow({
  campaign,
  distribution,
  onReviewAndSign
}: {
  readonly campaign: MyCampaign;
  readonly distribution: MyCampaignDistribution;
  readonly onReviewAndSign?: (campaign: MyCampaign, distribution: MyCampaignDistribution) => void;
}) {
  const row = toDistributionRow(distribution);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-control bg-page-surface px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold">{row.periodLabel ?? MY_CAMPAIGNS_COPY.distributionsTitle}</div>
        <div className="text-[13px] text-text-secondary">
          {row.amountArs} · <span>{row.amountXlm}</span>
        </div>
      </div>
      <span className="text-xs font-[650]">{row.stateLabel}</span>
      {needsSignature(distribution.state) ? (
        onReviewAndSign ? (
          <Button variant="secondary" onPress={() => onReviewAndSign(campaign, distribution)}>
            {MY_CAMPAIGNS_COPY.reviewAndSign}
          </Button>
        ) : (
          <Button variant="secondary" isDisabled disabledReason={MY_CAMPAIGNS_COPY.unavailable}>
            {MY_CAMPAIGNS_COPY.reviewAndSign}
          </Button>
        )
      ) : null}
    </li>
  );
}

function VaultRow({
  campaign,
  onDeclareSales,
  onReviewAndSign
}: {
  readonly campaign: MyCampaign;
  readonly onDeclareSales?: (campaign: MyCampaign) => void;
  readonly onReviewAndSign?: (campaign: MyCampaign, distribution: MyCampaignDistribution) => void;
}) {
  return (
    <li className="flex flex-col gap-4 rounded-card border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="aspect-[16/10] w-[96px] shrink-0 overflow-hidden rounded-control border border-border bg-page-surface">
            {campaign.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- an API-proxied bytes endpoint; next/image would need remote-pattern config.
              <img src={campaign.imageSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div aria-hidden="true" className="h-full w-full bg-page-surface" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="m-0 text-[17px] leading-[1.3] font-bold">{campaign.name}</h3>
            <div className="text-[13px] text-text-secondary">
              Bóveda {formatShortAddress(campaign.vaultAddress)}
            </div>
            <div className="text-[13px] text-text-secondary">
              {campaign.sector} · {campaign.city}
            </div>
            <div className="mt-1">
              <Badge variant="simulado" label="SIMULADO" lang="es" />
            </div>
          </div>
        </div>

        <div className={`flex max-w-[320px] flex-col gap-0.5 rounded-control p-2.5 text-[13px] ${TONE_BLOCK[MY_CAMPAIGN_STATE_TONE[campaign.state]]}`}>
          <strong className="font-[650]">{vaultStatusTitle(campaign.state, campaign.contributorsCount)}</strong>
          <span className="leading-[1.4]">{MY_CAMPAIGNS_COPY.vaultCustodyNote}</span>
        </div>
      </div>

      <ProgressBar
        label={`Progreso de ${campaign.name}`}
        value={campaign.fundedPercentBps}
        goal={10_000}
        isGoalReached={campaign.state === "settled"}
        formatValue={() =>
          campaign.raisedArs === null ? "Sin dato" : `${formatArsAmount(campaign.raisedArs)} de ${formatArsAmount(campaign.goalArs)}`
        }
      />

      {campaign.distributions.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {campaign.distributions.map((distribution) => (
            <DistributionRow
              key={distribution.distributionId}
              campaign={campaign}
              distribution={distribution}
              {...(onReviewAndSign ? { onReviewAndSign } : {})}
            />
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {onDeclareSales ? (
          <Button variant="secondary" onPress={() => onDeclareSales(campaign)}>
            {MY_CAMPAIGNS_COPY.declareSales}
          </Button>
        ) : (
          <Button variant="secondary" isDisabled disabledReason={MY_CAMPAIGNS_COPY.unavailable}>
            {MY_CAMPAIGNS_COPY.declareSales}
          </Button>
        )}
      </div>
    </li>
  );
}

export function CompanyVaultList({
  campaigns,
  sort,
  onSortChange,
  onDeclareSales,
  onReviewAndSign
}: CompanyVaultListProps) {
  return (
    <section aria-labelledby="company-vault-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="company-vault-heading" className="m-0 text-[26px] leading-[1.2] font-bold tracking-[-0.02em]">
          {MY_CAMPAIGNS_COPY.listTitle}
        </h2>
        {campaigns.length > 0 ? (
          <div role="group" aria-label="Ordenar" className="flex gap-0.5 rounded-control border border-border bg-page-surface p-[3px]">
            {SORT_OPTIONS.map((option) => {
              const active = sort === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSortChange(option.id)}
                  className={`h-9 cursor-pointer rounded-[7px] px-3 text-[13px] ${
                    active ? "bg-canvas font-[650]" : "bg-transparent font-medium"
                  } ${FOCUS_RING}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {campaigns.map((campaign) => (
          <VaultRow
            key={campaign.campaignId}
            campaign={campaign}
            {...(onDeclareSales ? { onDeclareSales } : {})}
            {...(onReviewAndSign ? { onReviewAndSign } : {})}
          />
        ))}
      </ul>
    </section>
  );
}
