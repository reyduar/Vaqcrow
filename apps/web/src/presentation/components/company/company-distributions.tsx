import { MY_CAMPAIGNS_COPY } from "@/application/company/copy";
import { toAggregateDistributionRows, type DistributionTone } from "@/application/company/distributions";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import { Badge } from "../badge";

/**
 * The aggregate «Distribuciones» section of the PyME dashboard (Feature #434,
 * WU2): every campaign's distributions in one list, each tagged with its
 * campaign and period, the ARS principal plus the approximate XLM and the
 * persisted state. Presentational: `application/company/distributions.ts`
 * already formats every cell. Meaning never lives in colour alone — the state
 * is always a visible label.
 *
 * The `Revisar y firmar` affordance lives on the nested rows of «Bóveda y
 * distribuciones» (so a single distribution never offers two signing buttons);
 * this section is the read-only aggregate, closed by the deterministic-
 * calculation footnote.
 */

const TONE_TEXT: Readonly<Record<DistributionTone, string>> = {
  neutral: "text-text-secondary",
  success: "text-trust-success",
  caution: "text-trust-caution",
  critical: "text-trust-critical"
};

export interface CompanyDistributionsProps {
  readonly campaigns: readonly MyCampaign[];
}

export function CompanyDistributions({ campaigns }: CompanyDistributionsProps) {
  const rows = toAggregateDistributionRows(campaigns);

  return (
    <section
      aria-labelledby="company-distributions-heading"
      className="flex flex-col gap-4 rounded-card border border-border p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="company-distributions-heading" className="m-0 text-[19px] font-bold">
          {MY_CAMPAIGNS_COPY.distributionsTitle}
        </h2>
        <Badge variant="simulado" label="SIMULADO" lang="es" />
      </div>

      {rows.length === 0 ? (
        <p className="m-0 text-sm text-text-secondary">{MY_CAMPAIGNS_COPY.noDistributions}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((row) => (
            <li
              key={row.distributionId}
              className="flex flex-wrap items-center gap-3 rounded-control bg-page-surface px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">{row.amountArs}</div>
                <div className="text-[13px] text-text-secondary">
                  {row.amountXlm} · {row.campaignName}
                  {row.periodLabel === null ? "" : ` · ${row.periodLabel}`}
                </div>
              </div>
              <span className={`text-xs font-[650] ${TONE_TEXT[row.tone]}`}>{row.stateLabel}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="m-0 text-xs text-text-secondary">{MY_CAMPAIGNS_COPY.footnote}</p>
    </section>
  );
}
