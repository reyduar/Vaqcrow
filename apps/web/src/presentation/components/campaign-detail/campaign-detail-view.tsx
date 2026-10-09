import type { IconType } from "react-icons";
import {
  IoAlertOutline,
  IoAnalyticsOutline,
  IoCheckmarkCircleOutline,
  IoHelpCircleOutline,
  IoInformationCircleOutline,
  IoPersonOutline,
  IoShieldCheckmarkOutline,
  IoShieldOutline,
  IoWarningOutline
} from "react-icons/io5";
import {
  formatArsAmount,
  formatFundedPercentLabel,
  formatRevenueSharePercent,
  fundedPercent
} from "@/application/marketplace/format";
import type { CampaignDetail } from "@/application/ports/campaign-detail-port";
import { microcopy } from "@/application/trust/disclosures";
import { Badge, type BadgeTone } from "../badge";
import { ProgressBar } from "../progress-bar";

/**
 * The account-gated campaign detail body (Feature #422, WU2): the template's
 * read-only sections (`docs/design/template/Vaqcrow Detalle PyME.dc.html`,
 * git-ignored). Presentational only — every value arrives already validated by
 * the port (the contract's API-relative `imageUrl` is already an absolute
 * `imageSrc`), and this file owns only the display formatting.
 *
 * The demo does not persist every field the template draws (the tagline beyond
 * `description`, the employee count, the percentage "usos de fondos", the sales
 * series — the account-private sales route is deliberately never fetched here).
 * Each of those renders the honest "Sin dato", never an invented value and
 * never a fabricated zero. A contribution action is deliberately absent (WU3
 * owns the flow); the aside shows the terms and the warnings only.
 */

const SIN_DATO = "Sin dato";

type RiskBandValue = NonNullable<CampaignDetail["riskBand"]>;

const RISK_LABEL: Readonly<Record<RiskBandValue, string>> = {
  low: "Riesgo bajo",
  medium: "Riesgo medio",
  high: "Riesgo alto"
};

const RISK_TONE: Readonly<Record<RiskBandValue, BadgeTone>> = {
  low: "info",
  medium: "caution",
  high: "critical"
};

const RISK_ICON: Readonly<Record<RiskBandValue, IconType>> = {
  low: IoShieldOutline,
  medium: IoAlertOutline,
  high: IoWarningOutline
};

/** Mirror of the campaign vocabulary `evidence-timeline.ts` and `campaign-workspace.tsx` render. */
const STATUS_LABEL: Readonly<Record<CampaignDetail["status"], string>> = {
  funding: "Fondeo abierto",
  settled: "Meta alcanzada",
  refunding: "Reembolso disponible"
};

const STATUS_TONE: Readonly<Record<CampaignDetail["status"], BadgeTone>> = {
  funding: "info",
  settled: "neutral",
  refunding: "caution"
};

const DAY = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const DATE_TIME = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
const CONFIDENCE = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? SIN_DATO : DAY.format(date);
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? SIN_DATO : DATE_TIME.format(date);
}

function SectionHeading({ id, children }: { readonly id: string; readonly children: string }) {
  return (
    <h2 id={id} className="m-0 text-2xl leading-tight font-bold tracking-[-0.02em]">
      {children}
    </h2>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-control bg-page-surface p-3.5">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="m-0 mt-1 text-base font-semibold">{value}</dd>
    </div>
  );
}

function CampaignImage({ detail }: { readonly detail: CampaignDetail }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-card border border-border bg-page-surface">
      {detail.imageSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- an API-proxied bytes endpoint; next/image would need remote-pattern config. */}
          <img src={detail.imageSrc} alt={`Foto de ${detail.name}`} className="h-full w-full object-cover" />
          <span className="absolute right-3.5 bottom-3.5 rounded-pill bg-text-primary/70 px-2.5 py-1 text-xs font-medium text-canvas">
            Imagen representativa
          </span>
        </>
      ) : (
        <span className="grid h-full w-full place-items-center text-sm text-text-secondary">
          Imagen no disponible
        </span>
      )}
    </div>
  );
}

function AboutSection({ detail }: { readonly detail: CampaignDetail }) {
  return (
    <section aria-labelledby="about-t" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading id="about-t">Sobre la PyME</SectionHeading>
        <Badge variant="simulado" label="SIMULADO" lang="es" />
      </div>
      <p className="m-0 max-w-[70ch] text-[17px] leading-[1.65] text-pretty text-text-secondary">
        {detail.description.trim() || SIN_DATO}
      </p>
      <dl className="m-0 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Fact label="Ciudad" value={detail.city} />
        <Fact label="Desde" value={formatDay(detail.foundedAt)} />
        <Fact label="Sector" value={detail.sector} />
        {/* Not persisted by the demo: the honest fallback, never an invented count. */}
        <Fact label="Empleados" value={SIN_DATO} />
      </dl>
    </section>
  );
}

function UsesSection() {
  return (
    <section
      aria-labelledby="use-t"
      className="flex flex-col gap-4 rounded-control border border-border p-6"
    >
      <SectionHeading id="use-t">Destino de los fondos</SectionHeading>
      <p className="m-0 text-base leading-relaxed text-text-secondary">
        {`${SIN_DATO}. El destino de los fondos no está persistido para esta campaña, así que no se muestra un desglose.`}
      </p>
    </section>
  );
}

function SalesEvidenceSection() {
  return (
    <section
      aria-labelledby="ev-t"
      className="flex flex-col gap-4 rounded-control border border-border p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading id="ev-t">Evidencia de ventas</SectionHeading>
        <Badge variant="simulado" label="SIMULADO" lang="es" />
      </div>
      <p className="m-0 text-base leading-relaxed text-text-secondary">
        {`${SIN_DATO}. La evidencia de ventas todavía no está disponible en este detalle.`}
      </p>
    </section>
  );
}

function AiRecommendationSection({ detail }: { readonly detail: CampaignDetail }) {
  const { assessment } = detail;
  const RiskIcon = assessment ? RISK_ICON[assessment.riskBand] : IoHelpCircleOutline;

  return (
    <section aria-labelledby="ai-t" className="flex flex-col gap-4 rounded-control border border-border p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IoAnalyticsOutline aria-hidden="true" focusable="false" className="text-[20px]" />
          <h2 id="ai-t" className="m-0 text-lg font-bold">
            Recomendación de IA
          </h2>
        </div>
        <span className="text-xs text-text-secondary">Consultiva · no aprueba</span>
      </div>

      {assessment ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="risk"
              label={RISK_LABEL[assessment.riskBand]}
              tone={RISK_TONE[assessment.riskBand]}
              icon={RiskIcon}
              lang="es"
            />
            {/* Confidence as es-AR decimals, e.g. "0,72". */}
            <span className="text-sm text-text-secondary">Confianza {CONFIDENCE.format(assessment.confidence)}</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm leading-relaxed">
            {assessment.reasons.map((reason, index) => (
              <li key={index} className="flex gap-2">
                <IoCheckmarkCircleOutline
                  aria-hidden="true"
                  focusable="false"
                  className="mt-0.5 shrink-0 text-[17px] text-brand-accent-text"
                />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-3 font-mono text-xs text-text-secondary">
            {`${assessment.model} · ${formatDateTime(assessment.generatedAt)}`}
          </div>
        </>
      ) : (
        <p className="m-0 text-sm leading-relaxed text-text-secondary">
          {`${SIN_DATO}. Todavía no hay una recomendación de IA registrada para esta campaña.`}
        </p>
      )}
    </section>
  );
}

function HumanDecisionSection({ detail }: { readonly detail: CampaignDetail }) {
  const { decision } = detail;
  return (
    <section aria-labelledby="hd-t" className="flex flex-col gap-3.5 rounded-control border-2 border-text-primary p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IoPersonOutline aria-hidden="true" focusable="false" className="text-[20px]" />
          <h2 id="hd-t" className="m-0 text-lg font-bold">
            Decisión humana
          </h2>
        </div>
        {decision ? <Badge variant="evidence" label="Aprobada" lang="es" /> : null}
      </div>
      <p className="m-0 text-sm leading-relaxed">{microcopy.humanDecision}</p>
      {decision ? (
        <dl className="m-0 grid grid-cols-[100px_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-sm">
          <dt className="text-text-secondary">Actor</dt>
          <dd className="m-0 font-semibold">{decision.actor}</dd>
          <dt className="text-text-secondary">Razón</dt>
          <dd className="m-0">{decision.reason}</dd>
          <dt className="text-text-secondary">Límite</dt>
          <dd className="m-0 font-semibold">
            {decision.approvedLimitArs === null ? SIN_DATO : formatArsAmount(decision.approvedLimitArs)}
          </dd>
          <dt className="text-text-secondary">Registrada</dt>
          <dd className="m-0">{formatDateTime(decision.recordedAt)}</dd>
        </dl>
      ) : (
        <p className="m-0 text-sm text-text-secondary">{`${SIN_DATO}. No hay una decisión humana registrada para esta campaña.`}</p>
      )}
    </section>
  );
}

function FundingAside({ detail }: { readonly detail: CampaignDetail }) {
  const raisedLabel = detail.raisedArs === null ? SIN_DATO : formatArsAmount(detail.raisedArs);
  const percent = fundedPercent(detail.fundedPercentBps);
  const percentLabel = formatFundedPercentLabel(detail.fundedPercentBps);
  const terms: ReadonlyArray<{ readonly k: string; readonly v: string }> = [
    { k: "Revenue share", v: formatRevenueSharePercent(detail.revenueShare) },
    { k: "Distribución", v: "Mensual" },
    { k: "Aporte mínimo", v: "10 XLM de prueba" },
    // The demo has a single fixed rule; the label matches the distribution UI.
    { k: "Regla de cálculo", v: "RS-2026-01" },
    { k: "Destino de liquidación", v: "Fijado por contrato · inmutable" }
  ];

  return (
    <aside aria-label="Aportar a la campaña" className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 lg:sticky lg:top-24">
      <div className="flex flex-col gap-4 rounded-card border border-border bg-raised p-6">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="transaction" label={STATUS_LABEL[detail.status]} tone={STATUS_TONE[detail.status]} lang="es" />
          <Badge variant="testnet" label={microcopy.testnetBadge} lang="es" size="compact" />
        </div>

        <div>
          <div className="text-xs font-medium text-text-secondary">Fondeado en la bóveda</div>
          <div className="mt-0.5 text-[34px] leading-[1.1] font-bold tracking-[-0.02em]">{raisedLabel}</div>
          <div className="mt-0.5 text-sm text-text-secondary">
            {`de ${formatArsAmount(detail.goalArs)} · ${detail.backers} aportantes`}
          </div>
          <div className="mt-3.5">
            <ProgressBar
              label="Progreso de fondeo"
              value={percent}
              goal={100}
              formatValue={() => percentLabel}
              isGoalReached={detail.status === "settled"}
            />
          </div>
          <div className="mt-2 flex justify-end text-[13px]">
            <span className="text-text-secondary">{`Cierra el ${formatDay(detail.closeDate)}`}</span>
          </div>
        </div>

        <dl className="m-0 flex flex-col">
          {terms.map((term) => (
            <div key={term.k} className="flex justify-between gap-3 border-t border-border py-2.5 text-sm">
              <dt className="text-text-secondary">{term.k}</dt>
              <dd className="m-0 text-right font-semibold">{term.v}</dd>
            </div>
          ))}
        </dl>

        <p className="m-0 text-center text-xs leading-relaxed text-text-secondary">
          Podés retirar tu aporte mientras el fondeo siga abierto. Freighter firma; Vaqcrow nunca recibe tu seed.
        </p>
      </div>

      <div className="flex gap-2.5 rounded-control bg-page-surface p-4 text-[13px] leading-relaxed">
        <IoInformationCircleOutline aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[18px]" />
        <span>
          Todo aporte está sujeto a riesgo. Las ventas pasadas de esta PyME, además de ser sintéticas, no anticipan
          resultados futuros.
        </span>
      </div>
    </aside>
  );
}

export function CampaignDetailView({ detail }: { readonly detail: CampaignDetail }) {
  const RiskIcon = detail.riskBand ? RISK_ICON[detail.riskBand] : IoHelpCircleOutline;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <nav aria-label="Ruta" className="flex flex-wrap gap-1.5 text-[13px] text-text-secondary">
          <a href="/explore" className="text-text-secondary underline underline-offset-[3px]">
            Explorar PyMEs
          </a>
          <span aria-hidden="true">/</span>
          <span>{detail.sector}</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex max-w-[720px] flex-col gap-3">
            <h1 className="m-0 text-[clamp(36px,4.6vw,52px)] leading-[1.05] font-bold tracking-[-0.035em] text-balance">
              {detail.name}
            </h1>
            <p className="m-0 text-lg leading-[1.55] text-pretty text-text-secondary">
              {detail.description.trim() || SIN_DATO}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="simulado"
              label={microcopy.kycStatusLabel}
              icon={IoShieldCheckmarkOutline}
              lang="es"
            />
            <Badge
              variant="risk"
              label={
                detail.riskBand
                  ? `${RISK_LABEL[detail.riskBand]} · confianza ${
                      detail.riskConfidence === null ? SIN_DATO : CONFIDENCE.format(detail.riskConfidence)
                    }`
                  : "Riesgo sin dato"
              }
              tone={detail.riskBand ? RISK_TONE[detail.riskBand] : "neutral"}
              icon={RiskIcon}
              lang="es"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-8">
          <CampaignImage detail={detail} />
          <AboutSection detail={detail} />
          <UsesSection />
          <SalesEvidenceSection />

          <div className="grid items-start gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
            <AiRecommendationSection detail={detail} />
            <HumanDecisionSection detail={detail} />
          </div>
        </div>

        <FundingAside detail={detail} />
      </div>
    </div>
  );
}
