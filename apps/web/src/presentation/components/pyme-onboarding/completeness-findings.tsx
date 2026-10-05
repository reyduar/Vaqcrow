"use client";

import { useEffect, useId, useState } from "react";
import { IoAlertCircleOutline, IoRemoveCircleOutline } from "react-icons/io5";
import { COMPLETENESS_COPY, completenessNotice, findingLabel } from "@/application/pyme-onboarding/completeness";
import type {
  CompletenessCheckInput,
  CompletenessCheckPort,
  CompletenessResult
} from "@/application/ports/completeness-check-port";

/**
 * The completeness findings of wizard step 3 (Feature #402, Task #403 / T1c).
 *
 * It runs `CompletenessCheckPort` once on mount — the wizard mounts it when
 * step 2's valid submit advances — and renders the API's concise list of
 * faltantes/anomalías with the `SIMULADO` marker. An incomplete result warns
 * (owner decision 2) but never blocks: the parent's «Continuar» stays enabled
 * and the human reviewer decides.
 *
 * Accessibility: each finding is a visible label plus its API `detail`, with an
 * icon; no meaning is carried by colour alone. The section has no live region,
 * so it never competes with the step's single analysis status.
 */

type CompletenessPhase = "loading" | "done" | "error";

interface CompletenessState {
  readonly phase: CompletenessPhase;
  readonly result: CompletenessResult | null;
}

export interface CompletenessFindingsProps {
  readonly port: CompletenessCheckPort;
  /** Stable across renders; the wizard captures it at step 2's submit. */
  readonly input: CompletenessCheckInput;
}

export function CompletenessFindings({ port, input }: CompletenessFindingsProps) {
  const titleId = useId();
  const [state, setState] = useState<CompletenessState>({ phase: "loading", result: null });

  useEffect(() => {
    let cancelled = false;
    // State is set only from the async callback (never synchronously in the
    // effect body): the initial state is already the loading state, and the
    // port/input pair is stable for the life of the step.
    port.check(input).then(
      (outcome) => {
        if (cancelled) return;
        setState(
          outcome.ok
            ? { phase: "done", result: outcome.result }
            : { phase: "error", result: null }
        );
      },
      () => {
        if (cancelled) return;
        setState({ phase: "error", result: null });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [port, input]);

  const { phase, result } = state;
  const notice = result ? completenessNotice(result) : null;

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-card border border-page-border bg-page-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} className="m-0 text-[15px] font-[650]">
          {COMPLETENESS_COPY.title}
        </h2>
        <span className="inline-flex h-[22px] items-center rounded-pill border border-dashed border-text-secondary px-2 text-[11px] font-[650] tracking-[0.06em] text-text-secondary">
          {COMPLETENESS_COPY.simulado}
        </span>
      </div>

      {phase === "loading" ? (
        <p aria-busy="true" className="m-0 text-sm text-text-secondary">
          {COMPLETENESS_COPY.loading}
        </p>
      ) : null}

      {phase === "done" && result ? (
        <>
          {result.findings.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {result.findings.map((finding, index) => {
                const FindingIcon = finding.severity === "gap" ? IoRemoveCircleOutline : IoAlertCircleOutline;
                return (
                  <li
                    key={`${finding.code}-${index}`}
                    className="flex items-start gap-2.5 text-sm leading-[1.5]"
                  >
                    <FindingIcon
                      aria-hidden="true"
                      focusable="false"
                      className="mt-0.5 shrink-0 text-[18px] text-trust-caution"
                    />
                    <span>
                      <strong className="font-[650]">{findingLabel(finding)}:</strong>{" "}
                      <span className="text-text-secondary">{finding.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {notice ? (
            <p
              className={
                result.complete
                  ? "m-0 text-sm text-text-secondary"
                  : "m-0 flex items-start gap-2 rounded-card bg-trust-caution-surface p-3 text-sm leading-[1.5] text-trust-caution"
              }
            >
              {result.complete ? null : (
                <IoAlertCircleOutline aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[18px]" />
              )}
              {notice}
            </p>
          ) : null}
        </>
      ) : null}

      {phase === "error" ? (
        <p className="m-0 flex items-start gap-2 text-sm leading-[1.5] text-text-secondary">
          <IoAlertCircleOutline
            aria-hidden="true"
            focusable="false"
            className="mt-0.5 shrink-0 text-[18px] text-trust-caution"
          />
          {COMPLETENESS_COPY.errorMessage}
        </p>
      ) : null}
    </section>
  );
}
