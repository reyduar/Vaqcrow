import { formatArs, formatRateBps } from "@/application/distribution/derivation-format";
import { formatStroopsAsXlm } from "@/application/format/stroops";
import type { PreparedRevenueShareDistribution } from "@vaqcrow/contracts";
import { Badge } from "./badge";

const EXCLUSION_REASON: Readonly<
  Record<PreparedRevenueShareDistribution["derivation"]["excludedPeriods"][number]["reason"], string>
> = {
  missing_data: "faltan datos",
  requires_review: "requiere revisión"
};

const EXCLUSION_STATUS: Readonly<
  Record<PreparedRevenueShareDistribution["derivation"]["excludedPeriods"][number]["status"], string>
> = {
  missing: "Período faltante",
  anomalous: "Período anómalo"
};

export interface DistributionDerivationProps {
  readonly derivation: PreparedRevenueShareDistribution["derivation"];
  readonly recipients: PreparedRevenueShareDistribution["recipients"];
}

/**
 * The facts the service derived the distribution from, shown before anything is
 * signed so a person sees why each investor is paid what they are paid. Display
 * only: every figure is the API's own, formatted; nothing is recalculated here.
 * The sales series, the approved limit and the ARS-to-XLM proportion are all
 * synthetic and labeled so.
 */
export function DistributionDerivation({ derivation, recipients }: DistributionDerivationProps) {
  const { conversion } = derivation;

  return (
    <section
      aria-label="Cálculo de la distribución"
      lang="es"
      className="flex flex-col gap-4 rounded-card border border-border p-6"
    >
      <h4 className="m-0 flex flex-wrap items-center gap-2 text-base font-bold tracking-[-0.01em]">
        Cálculo de la distribución <Badge variant="simulado" label="SIMULADO" lang="es" />
      </h4>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-text-secondary">Versión de la regla</dt>
        <dd className="m-0 font-mono">{derivation.ruleVersion}</dd>
        <dt className="text-text-secondary">Período</dt>
        <dd className="m-0">{derivation.period}</dd>
        <dt className="text-text-secondary">Ventas informadas</dt>
        <dd className="m-0">{formatArs(derivation.salesArs)}</dd>
        <dt className="text-text-secondary">Tasa</dt>
        <dd className="m-0">{formatRateBps(derivation.rateBps)}</dd>
        <dt className="text-text-secondary">Obligación</dt>
        <dd className="m-0 font-semibold">{formatArs(derivation.obligationArs)}</dd>
      </dl>

      {derivation.excludedPeriods.length === 0 ? (
        <p className="m-0 text-sm">Ningún período quedó excluido.</p>
      ) : (
        <div className="text-sm">
          <p className="m-0">Períodos excluidos del cálculo:</p>
          <ul className="m-0 list-disc pl-5">
            {derivation.excludedPeriods.map((excluded) => (
              <li key={excluded.period}>
                {`${excluded.period}: ${EXCLUSION_STATUS[excluded.status]} (${EXCLUSION_REASON[excluded.reason]})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-sm">
        <p className="m-0">
          Base de conversión: la obligación en pesos se reparte en la misma proporción en que se
          fondeó la campaña; no es una cotización de mercado.
        </p>
        <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-text-secondary">Meta de la campaña</dt>
          <dd className="m-0">{`${formatStroopsAsXlm(BigInt(conversion.goalStroops))} XLM`}</dd>
          <dt className="text-text-secondary">Límite aprobado</dt>
          <dd className="m-0">{formatArs(conversion.approvedLimitArs)}</dd>
          <dt className="text-text-secondary">Total a distribuir</dt>
          <dd className="m-0">{`${formatStroopsAsXlm(BigInt(conversion.totalStroops))} XLM`}</dd>
        </dl>
      </div>

      <ul aria-label="Destinatarios" className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        {recipients.map((recipient, index) => (
          <li
            key={recipient.accountId}
            className="flex flex-wrap items-center gap-2 rounded-control border border-border p-3"
          >
            <span>{`Destinatario ${index + 1}: ${formatStroopsAsXlm(recipient.amountStroops)} XLM`}</span>
            <span className="font-mono text-xs break-all text-text-secondary">{recipient.accountId}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
