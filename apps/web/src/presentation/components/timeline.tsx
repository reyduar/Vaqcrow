import { IoCheckmarkOutline } from "react-icons/io5";

/**
 * Timeline (Issue #314 / T2): the "Recorrido de la demo" step list from
 * `Vaqcrow Sistema.dc.html` (`docs/design/template/`, git-ignored) — an
 * ordered list of demo steps with a done/current/pending state. Vertical
 * orientation only: the template's horizontal variant
 * (`Vaqcrow Onboarding PyME.dc.html`'s stepper) uses a materially different
 * layout — a flex row with `flex`-sized segments and an inline connecting
 * bar between circular nodes, rather than this component's `<ol>` grid with
 * an absolutely-stacked line — so adding both was not "cheap" within this
 * task's scope; this decision is recorded rather than left implicit.
 *
 * Colour choice: `done`/`current` reuse the existing `--color-trust-*`
 * tokens (`trust-neutral`/`trust-info`) rather than introducing a "success"
 * green — the codebase's established rule (Feature #17/#310) is that no
 * `BadgeTone` has a `success` member, so nothing here reads as a financial
 * success signal; `done` is instead conveyed by its checkmark icon plus the
 * visible "Completado" text, never colour alone.
 */
export type TimelineStepState = "done" | "current" | "pending";

export interface TimelineStep {
  readonly label: string;
  readonly description?: string;
  readonly state: TimelineStepState;
}

export interface TimelineProps {
  readonly steps: readonly TimelineStep[];
  readonly className?: string;
}

const STATE_LABEL: Readonly<Record<TimelineStepState, string>> = {
  done: "Completado",
  current: "Paso actual",
  pending: "Pendiente"
};

const DOT_CLASS: Readonly<Record<TimelineStepState, string>> = {
  done: "border border-trust-neutral/30 bg-trust-neutral/10 text-trust-neutral",
  current: "border border-trust-info/30 bg-trust-info/10 text-trust-info",
  pending: "border border-dashed border-border text-muted"
};

const LABEL_CLASS: Readonly<Record<TimelineStepState, string>> = {
  done: "text-sm font-medium",
  current: "text-sm font-bold",
  pending: "text-sm font-medium text-muted"
};

export function Timeline({ steps, className }: TimelineProps) {
  return (
    <ol className={`m-0 flex list-none flex-col p-0 ${className ?? ""}`.trim()}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li
            key={`${step.label}-${index}`}
            {...(step.state === "current" ? { "aria-current": "step" as const } : {})}
            className="grid grid-cols-[28px_minmax(0,1fr)] gap-3"
          >
            <div data-part="dot-wrapper" aria-hidden="true" className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${DOT_CLASS[step.state]}`}
              >
                {step.state === "done" ? (
                  <IoCheckmarkOutline focusable="false" />
                ) : (
                  index + 1
                )}
              </span>
              {!isLast ? <span data-part="connector" className="w-px flex-1 bg-border" /> : null}
            </div>
            <div className="pt-0.5 pb-3">
              <div className={LABEL_CLASS[step.state]}>{step.label}</div>
              <div className="text-xs text-muted">{STATE_LABEL[step.state]}</div>
              {step.description ? <p className="m-0 mt-1 text-sm text-muted">{step.description}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
