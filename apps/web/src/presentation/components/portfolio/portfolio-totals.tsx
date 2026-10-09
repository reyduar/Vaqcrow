import { formatXlmAmount } from "@/application/portfolio/format";
import type { PortfolioTotals as PortfolioTotalsData } from "@/application/ports/portfolio-port";

/**
 * The two investor stat cards of `Vaqcrow Portafolio.dc.html:283-285`
 * (Feature #426, WU2). Presentational: every value arrives already computed and
 * formatted. `totalDistributionsXlm === null` renders the honest "Sin dato",
 * never a fabricated `0,0000000`.
 */

const SIN_DATO = "Sin dato";

export interface PortfolioTotalsProps {
  readonly totals: PortfolioTotalsData;
}

function StatCard({ label, value, note }: { readonly label: string; readonly value: string; readonly note: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-border p-5">
      <span className="text-[13px] font-medium text-text-secondary">{label}</span>
      <span className="text-[26px] leading-[1.15] font-bold tracking-[-0.02em]">{value}</span>
      <span className="text-[13px] text-text-secondary">{note}</span>
    </div>
  );
}

export function PortfolioTotals({ totals }: PortfolioTotalsProps) {
  const campaignNote = `En ${totals.campaignCount} campaña${totals.campaignCount === 1 ? "" : "s"}`;
  const distributions = totals.totalDistributionsXlm === null ? SIN_DATO : formatXlmAmount(totals.totalDistributionsXlm);

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
      <StatCard label="Total aportado" value={formatXlmAmount(totals.totalContributedXlm)} note={campaignNote} />
      <StatCard
        label="Distribuciones recibidas"
        value={distributions}
        note="Calculadas para períodos simulados"
      />
    </div>
  );
}
