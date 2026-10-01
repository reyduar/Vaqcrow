import { Link } from "@heroui/react";
import { IoAlertOutline, IoShieldOutline, IoWarningOutline } from "react-icons/io5";
import type { IconType } from "react-icons";
import { Badge, type BadgeTone } from "./badge";
import { Button } from "./button";
import { ProgressBar } from "./progress-bar";

/**
 * CampaignCard (Issue #314 / T1): the campaign/PyME card from `Vaqcrow
 * Sistema.dc.html` ("Compuestos") and `Vaqcrow Explorar PyMEs.dc.html`
 * (`docs/design/template/`, git-ignored) — SME name, funding progress,
 * revenue-share terms and risk level. Presentational only: every number
 * (`raisedValue`/`goal`, the revenue-share/risk text) arrives already
 * computed and formatted by the caller; this component performs no
 * arithmetic and makes no funding promise of its own.
 */
export type CampaignRiskLevel = "low" | "medium" | "high";

export interface CampaignCardAction {
  readonly label: string;
}

export type CampaignCardActionProp =
  | (CampaignCardAction & { readonly href: string; readonly onPress?: never })
  | (CampaignCardAction & { readonly onPress: () => void; readonly href?: never });

const RISK_TONE: Readonly<Record<CampaignRiskLevel, BadgeTone>> = {
  low: "info",
  medium: "caution",
  high: "critical"
};

const RISK_ICON: Readonly<Record<CampaignRiskLevel, IconType>> = {
  low: IoShieldOutline,
  medium: IoAlertOutline,
  high: IoWarningOutline
};

const HEADING_TAGS = ["h2", "h3", "h4", "h5", "h6"] as const;
type HeadingTag = (typeof HEADING_TAGS)[number];

export interface CampaignCardProps {
  readonly smeName: string;
  /** Heading level for the SME name; defaults to 3. */
  readonly headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Already formatted by the caller, e.g. "Panificación · Córdoba". */
  readonly subtitle?: string;
  readonly raisedLabel: string;
  readonly raisedValue: number;
  readonly goal: number;
  readonly formatRaised?: (value: number, goal: number) => string;
  /** Only set by the caller once the goal is explicitly confirmed reached — see `ProgressBar`. */
  readonly isGoalReached?: boolean;
  /** Already formatted by the caller, e.g. "Cierra el 30/11/2026". */
  readonly closeDateLabel?: string;
  /** Already formatted by the caller, e.g. "4,5 % de ventas". */
  readonly revenueShareTerms: string;
  readonly riskLevel: CampaignRiskLevel;
  /** Already formatted by the caller, e.g. "Riesgo medio" — meaning never lives in colour alone. */
  readonly riskLabel: string;
  /**
   * Renders a SIMULADO badge when set, reusing the `Badge`/`SyntheticValue`
   * (Feature #17) pattern. Sourced by the caller from the fixture record
   * itself; never hardcoded here.
   */
  readonly simuladoLabel?: string;
  readonly action?: CampaignCardActionProp;
  readonly className?: string;
}

export function CampaignCard({
  smeName,
  headingLevel = 3,
  subtitle,
  raisedLabel,
  raisedValue,
  goal,
  formatRaised,
  isGoalReached = false,
  closeDateLabel,
  revenueShareTerms,
  riskLevel,
  riskLabel,
  simuladoLabel,
  action,
  className
}: CampaignCardProps) {
  const HeadingTag: HeadingTag = HEADING_TAGS[headingLevel - 2] ?? "h3";
  const RiskIcon = RISK_ICON[riskLevel];

  return (
    <article
      className={`flex flex-col gap-5 rounded-card border border-border p-6 ${className ?? ""}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {/* Template card title: 20 px / 700 (`Vaqcrow Sistema.dc.html` line 253). */}
          <HeadingTag className="m-0 text-xl leading-tight font-bold">{smeName}</HeadingTag>
          {subtitle ? <div className="mt-0.5 text-sm text-text-secondary">{subtitle}</div> : null}
        </div>
        {simuladoLabel ? <Badge variant="simulado" label={simuladoLabel} lang="es" /> : null}
      </div>

      <div className="flex flex-col gap-2">
        <ProgressBar
          label={raisedLabel}
          value={raisedValue}
          goal={goal}
          {...(formatRaised ? { formatValue: formatRaised } : {})}
          isGoalReached={isGoalReached}
        />
        {closeDateLabel ? <div className="text-sm text-text-secondary">{closeDateLabel}</div> : null}
      </div>

      <dl className="m-0 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <dt className="text-xs text-text-secondary">Revenue share</dt>
          <dd className="m-0 mt-0.5 font-semibold">{revenueShareTerms}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-secondary">Riesgo</dt>
          <dd className="m-0 mt-0.5">
            <Badge
              variant="risk"
              label={riskLabel}
              tone={RISK_TONE[riskLevel]}
              icon={RiskIcon}
              lang="es"
            />
          </dd>
        </div>
      </dl>

      {action ? (
        <div className="mt-auto">
          {action.href ? (
            <Link href={action.href}>{action.label}</Link>
          ) : (
            <Button variant="secondary" {...(action.onPress ? { onPress: action.onPress } : {})}>
              {action.label}
            </Button>
          )}
        </div>
      ) : null}
    </article>
  );
}
