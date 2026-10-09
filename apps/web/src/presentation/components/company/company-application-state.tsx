import type { IconType } from "react-icons";
import {
  IoCloseCircleOutline,
  IoCheckmarkCircleOutline,
  IoCreateOutline,
  IoDocumentTextOutline,
  IoHourglassOutline
} from "react-icons/io5";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import {
  APPLICATION_STATE_SECTION_LABEL,
  applicationStateView,
  type ApplicationStateIcon,
  type ApplicationStateTone
} from "@/application/company/application-state";

/**
 * The PyME's application-state banner (Feature #434, WU5, owner decision D6):
 * «En revisión» / «Requiere cambios» / «Rechazada» / «Aprobada» and the
 * pre-vault «Sin enviar» empty state, so the PyME knows where it stands. The
 * template's PyME mode does not design these states, so the copy is neutral,
 * honest Spanish and owner-pending (see `application-state.ts`).
 *
 * Presentational only: the caller supplies the state. It renders nothing about
 * money, never promises a return, and never claims a decision that was not
 * recorded.
 */
export interface CompanyApplicationStateProps {
  /** The application's review state, or `null` when the PyME has no application yet. */
  readonly state: ApplicationReviewState | null;
}

const ICONS: Readonly<Record<ApplicationStateIcon, IconType>> = {
  document: IoDocumentTextOutline,
  hourglass: IoHourglassOutline,
  create: IoCreateOutline,
  check: IoCheckmarkCircleOutline,
  close: IoCloseCircleOutline
};

const TONE_SURFACE: Readonly<Record<ApplicationStateTone, string>> = {
  info: "bg-page-surface",
  caution: "bg-trust-caution-surface",
  success: "bg-trust-success-surface",
  critical: "bg-trust-critical-surface"
};

const TONE_TEXT: Readonly<Record<ApplicationStateTone, string>> = {
  info: "text-text-secondary",
  caution: "text-trust-caution",
  success: "text-trust-success",
  critical: "text-trust-critical"
};

export function CompanyApplicationState({ state }: CompanyApplicationStateProps) {
  const view = applicationStateView(state);
  const Icon = ICONS[view.icon];

  return (
    <section
      role="region"
      aria-label={APPLICATION_STATE_SECTION_LABEL}
      className={`flex items-start gap-3 rounded-card p-4 ${TONE_SURFACE[view.tone]}`}
    >
      <Icon
        aria-hidden="true"
        focusable="false"
        className={`mt-0.5 shrink-0 text-[22px] ${TONE_TEXT[view.tone]}`}
      />
      <div className="text-sm leading-normal">
        <strong className={`text-[15px] font-[650] ${TONE_TEXT[view.tone]}`}>{view.label}</strong>
        <br />
        {view.message}
      </div>
    </section>
  );
}
