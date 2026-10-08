import { Link } from "@heroui/react";
import type { ReactNode } from "react";
import { IoAlertOutline, IoHelpCircleOutline, IoShieldOutline, IoWarningOutline } from "react-icons/io5";
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
 *
 * Feature #414 (WU4b) adds three optional extension points for the
 * marketplace grid without changing the legacy layout: a 16:10 `image`
 * header (which moves the risk/SIMULADO badges into an overlay and swaps the
 * details "Riesgo" row for "Cierre"), a top-right `overlayAction` slot (the
 * favorite heart) and a `progressSlot` the caller can compose. `riskLevel`
 * became optional so a caller with only a label renders a neutral risk badge
 * instead of a colour-only one; the funding numbers are likewise optional
 * because `progressSlot` replaces the built-in bar entirely.
 */
export type CampaignRiskLevel = "low" | "medium" | "high";

export interface CampaignCardAction {
  readonly label: string;
  /**
   * Optional accessible name richer than the visible label — e.g. the
   * template's `aria-label="Ver evidencia y riesgo de <PyME>"` while the link
   * still reads "Ver evidencia y riesgo".
   */
  readonly ariaLabel?: string;
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

export interface CampaignCardImage {
  readonly src: string;
  readonly alt: string;
}

export interface CampaignCardProps {
  readonly smeName: string;
  /** Heading level for the SME name; defaults to 3. */
  readonly headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Already formatted by the caller, e.g. "Panificación · Córdoba". */
  readonly subtitle?: string;
  readonly raisedLabel?: string;
  readonly raisedValue?: number;
  readonly goal?: number;
  readonly formatRaised?: (value: number, goal: number) => string;
  /** Only set by the caller once the goal is explicitly confirmed reached — see `ProgressBar`. */
  readonly isGoalReached?: boolean;
  /** Already formatted by the caller, e.g. "30/11/2026". */
  readonly closeDateLabel?: string;
  /** Already formatted by the caller, e.g. "4,5 % de ventas". */
  readonly revenueShareTerms: string;
  /** `null`/omitted renders a neutral risk badge from `riskLabel` alone. */
  readonly riskLevel?: CampaignRiskLevel | null;
  /** Already formatted by the caller, e.g. "Riesgo medio" — meaning never lives in colour alone. */
  readonly riskLabel?: string;
  /**
   * Renders a SIMULADO badge when set, reusing the `Badge`/`SyntheticValue`
   * (Feature #17) pattern. Sourced by the caller from the fixture record
   * itself; never hardcoded here.
   */
  readonly simuladoLabel?: string;
  /** 16:10 header image; its presence moves the badges into an overlay. */
  readonly image?: CampaignCardImage;
  /** Rendered top-right over the card, with or without an image (e.g. the favorite heart). */
  readonly overlayAction?: ReactNode;
  /** Replaces the built-in progress block when provided. */
  readonly progressSlot?: ReactNode;
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
  image,
  overlayAction,
  progressSlot,
  action,
  className
}: CampaignCardProps) {
  const HeadingTag: HeadingTag = HEADING_TAGS[headingLevel - 2] ?? "h3";
  const RiskIcon = riskLevel ? RISK_ICON[riskLevel] : IoHelpCircleOutline;
  const riskTone: BadgeTone = riskLevel ? RISK_TONE[riskLevel] : "neutral";

  const progressBlock =
    progressSlot !== undefined ? (
      progressSlot
    ) : raisedLabel !== undefined && raisedValue !== undefined && goal !== undefined ? (
      <ProgressBar
        label={raisedLabel}
        value={raisedValue}
        goal={goal}
        {...(formatRaised ? { formatValue: formatRaised } : {})}
        isGoalReached={isGoalReached}
      />
    ) : null;

  const riskBadge = riskLabel ? (
    <Badge variant="risk" label={riskLabel} tone={riskTone} icon={RiskIcon} lang="es" />
  ) : null;

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-card border border-border ${className ?? ""}`.trim()}
    >
      {image ? (
        <div className="relative aspect-[16/10] w-full bg-page-surface">
          {/* eslint-disable-next-line @next/next/no-img-element -- an API-proxied bytes endpoint; next/image would need remote-pattern config. */}
          <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {riskBadge}
            {simuladoLabel ? <Badge variant="simulado" label={simuladoLabel} lang="es" /> : null}
          </div>
        </div>
      ) : null}

      {overlayAction ? <div className="absolute top-3 right-3 z-10">{overlayAction}</div> : null}

      <div className="flex flex-1 flex-col gap-5 p-6">
        <div className={`flex items-start justify-between gap-3 ${!image && overlayAction ? "pr-12" : ""}`.trim()}>
          <div>
            {/* Template card title: 20 px / 700 (`Vaqcrow Sistema.dc.html` line 253). */}
            <HeadingTag className="m-0 text-xl leading-tight font-bold">{smeName}</HeadingTag>
            {subtitle ? <div className="mt-0.5 text-sm text-text-secondary">{subtitle}</div> : null}
          </div>
          {!image && simuladoLabel ? <Badge variant="simulado" label={simuladoLabel} lang="es" /> : null}
        </div>

        {progressBlock || (!image && closeDateLabel) ? (
          <div className="flex flex-col gap-2">
            {progressBlock}
            {!image && closeDateLabel ? (
              <div className="text-sm text-text-secondary">{closeDateLabel}</div>
            ) : null}
          </div>
        ) : null}

        <dl className="m-0 grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div>
            <dt className="text-xs text-text-secondary">Revenue share</dt>
            <dd className="m-0 mt-0.5 font-semibold">{revenueShareTerms}</dd>
          </div>
          {image && closeDateLabel ? (
            <div>
              <dt className="text-xs text-text-secondary">Cierre</dt>
              <dd className="m-0 mt-0.5 font-semibold">{closeDateLabel}</dd>
            </div>
          ) : !image && riskLabel ? (
            <div>
              <dt className="text-xs text-text-secondary">Riesgo</dt>
              <dd className="m-0 mt-0.5">{riskBadge}</dd>
            </div>
          ) : null}
        </dl>

        {action ? (
          <div className="mt-auto">
            {action.href ? (
              <Link href={action.href} {...(action.ariaLabel ? { "aria-label": action.ariaLabel } : {})}>
                {action.label}
              </Link>
            ) : (
              <Button variant="secondary" {...(action.onPress ? { onPress: action.onPress } : {})}>
                {action.label}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
