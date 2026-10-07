import type { IconType } from "react-icons";
import {
  IoAlertCircleOutline,
  IoAnalyticsOutline,
  IoInformationCircleOutline,
  IoWarningOutline
} from "react-icons/io5";
import {
  ASSESSMENT_COPY,
  assessmentSectionFor,
  type AssessmentItem,
  type AssessmentRiskIcon,
  type AssessmentRiskTone
} from "@/application/admin/assessment";
import type { AdminReviewContext } from "@/application/ports/admin-review-port";

const RISK_ICONS: Readonly<Record<AssessmentRiskIcon, IconType>> = {
  low: IoInformationCircleOutline,
  medium: IoAlertCircleOutline,
  high: IoWarningOutline
};

const RISK_TONE: Readonly<Record<AssessmentRiskTone, string>> = {
  neutral: "bg-page-surface text-text-primary",
  caution: "bg-trust-caution-surface text-trust-caution",
  critical: "bg-trust-critical-surface text-trust-critical"
};

const CHIP = "inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-[650]";

export interface AssessmentSectionProps {
  readonly context: AdminReviewContext;
}

/**
 * Section «2 · Recomendación de IA» of the admin review (`Vaqcrow
 * Admin.dc.html`, view `review`; #410 / U4). Read-only and advisory: it shows
 * the persisted assessment and has no control that could decide anything.
 * The risk chip carries an icon besides its text, so it never relies on color
 * alone, and a simulated assessment keeps its `SIMULADO` badge next to its
 * origin (`demo-ui.md` §2).
 */
export function AssessmentSection({ context }: AssessmentSectionProps) {
  const view = assessmentSectionFor(context.assessment);

  return (
    <section
      aria-labelledby="assessment-title"
      className="flex flex-col gap-3 rounded-card border border-page-border p-[22px] text-text-primary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IoAnalyticsOutline aria-hidden="true" focusable="false" className="text-xl" />
          <h2 id="assessment-title" className="m-0 text-lg font-bold">
            {ASSESSMENT_COPY.title}
          </h2>
        </div>
        <span className="text-xs text-text-secondary">{ASSESSMENT_COPY.advisory}</span>
      </div>

      {view.kind === "empty" ? (
        <p className="m-0 text-sm text-text-secondary">{view.message}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2.5">
            <span className={`${CHIP} ${RISK_TONE[view.risk.tone]}`}>
              <RiskIcon icon={view.risk.icon} />
              {view.risk.label}
            </span>
            <span className={`${CHIP} bg-page-surface`}>{view.confidenceLabel}</span>
          </div>

          <ul className="m-0 list-disc pl-[18px] text-sm leading-relaxed text-text-secondary">
            {view.items.map((item, index) => (
              <AssessmentListItem key={`${item.kind}-${index}`} item={item} />
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-text-secondary">
            {view.simulated ? (
              <span className="rounded-pill border border-dashed border-text-secondary px-2 py-[3px] font-sans text-[11px] font-[650] tracking-[0.04em] text-text-primary">
                {ASSESSMENT_COPY.simulated}
              </span>
            ) : null}
            <span>{view.footer}</span>
          </div>
        </>
      )}
    </section>
  );
}

function RiskIcon({ icon }: { readonly icon: AssessmentRiskIcon }) {
  const Icon = RISK_ICONS[icon];
  return <Icon aria-hidden="true" focusable="false" className="shrink-0 text-base" />;
}

function AssessmentListItem({ item }: { readonly item: AssessmentItem }) {
  if (item.kind === "reason") {
    return (
      <li>
        {item.text}
        <span className="block font-mono text-xs break-all">{item.evidence}</span>
      </li>
    );
  }
  return <li className={item.kind === "anomaly" ? "text-trust-caution" : undefined}>{item.text}</li>;
}
