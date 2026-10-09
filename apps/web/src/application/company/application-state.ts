import type { ApplicationReviewState } from "@vaqcrow/contracts";

/**
 * Pure model of the PyME's own application states (Feature #434, WU5, owner
 * decision D6): «En revisión» / «Requiere cambios» / «Rechazada» / «Aprobada»
 * plus the pre-vault empty state, so the PyME knows where it stands. React-free
 * so the mapping and its copy are unit-tested without rendering.
 *
 * The template's PyME mode (`Vaqcrow Portafolio.dc.html`) does not design these
 * states, so this copy is neutral, honest Spanish (voseo) and owner-pending —
 * see the WU5 advisory in `odd/tasks/pyme-mi-campana-dashboard.md`.
 *
 * The six `application_review` states fold into the display keys the PyME
 * reads: `draft` is an application that exists but was never sent (the PyME
 * wizard submits straight into `awaiting_assessment`, so it is defensive), and
 * `awaiting_assessment`/`human_review` both read as «En revisión».
 */

/** The tone drives the surface and text colour; the label always carries the meaning. */
export type ApplicationStateTone = "info" | "caution" | "success" | "critical";

/** Decorative icon key; the presentation layer maps it to a react-icons component. */
export type ApplicationStateIcon = "document" | "hourglass" | "create" | "check" | "close";

/** One display state the PyME reads. `not_sent` is also the pre-vault empty state. */
export type ApplicationStateKey = "not_sent" | "awaiting_review" | "changes_requested" | "rejected" | "approved";

export interface ApplicationStateView {
  readonly key: ApplicationStateKey;
  readonly label: string;
  readonly message: string;
  readonly tone: ApplicationStateTone;
  readonly icon: ApplicationStateIcon;
}

/** Section label; the template does not design this banner (owner-pending). */
export const APPLICATION_STATE_SECTION_LABEL = "Estado de tu solicitud";

/**
 * Neutral, honest copy per display state. The template designs none of these,
 * so every string is owner-pending and never promises a return or a decision
 * that was not recorded.
 */
export const APPLICATION_STATE_COPY: Readonly<
  Record<ApplicationStateKey, { readonly label: string; readonly message: string }>
> = Object.freeze({
  not_sent: {
    label: "Sin enviar",
    message: "Todavía no enviaste tu solicitud a revisión. Cuando la envíes, acá vas a ver el estado."
  },
  awaiting_review: {
    label: "En revisión",
    message: "Tu solicitud está en revisión. Todavía no está aprobada ni publicada."
  },
  changes_requested: {
    label: "Requiere cambios",
    message: "La revisión pidió cambios en tu solicitud."
  },
  rejected: {
    label: "Rechazada",
    message: "Tu solicitud fue rechazada."
  },
  approved: {
    label: "Aprobada",
    message: "Tu solicitud fue aprobada. La bóveda se despliega en Stellar Testnet."
  }
});

const STATE_KEY: Readonly<Record<ApplicationReviewState, ApplicationStateKey>> = Object.freeze({
  draft: "not_sent",
  awaiting_assessment: "awaiting_review",
  human_review: "awaiting_review",
  approved: "approved",
  changes_requested: "changes_requested",
  rejected: "rejected"
});

const STATE_TONE: Readonly<Record<ApplicationStateKey, ApplicationStateTone>> = Object.freeze({
  not_sent: "info",
  awaiting_review: "caution",
  changes_requested: "caution",
  rejected: "critical",
  approved: "success"
});

const STATE_ICON: Readonly<Record<ApplicationStateKey, ApplicationStateIcon>> = Object.freeze({
  not_sent: "document",
  awaiting_review: "hourglass",
  changes_requested: "create",
  rejected: "close",
  approved: "check"
});

/**
 * Maps an application's review state to the display view the PyME reads.
 * `null` (no application yet) is the pre-vault empty state and reads as
 * «Sin enviar», never as a fabricated in-review state.
 */
export function applicationStateView(state: ApplicationReviewState | null): ApplicationStateView {
  const key = state === null ? "not_sent" : STATE_KEY[state];
  const copy = APPLICATION_STATE_COPY[key];
  return { key, label: copy.label, message: copy.message, tone: STATE_TONE[key], icon: STATE_ICON[key] };
}
