"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IoAlertCircleOutline, IoRemoveCircleOutline, IoSyncOutline } from "react-icons/io5";
import { COMPLETENESS_COPY, completenessErrorMessage, completenessNotice, findingLabel } from "@/application/pyme-onboarding/completeness";
import type {
  CompletenessCheckInput,
  CompletenessCheckPort,
  CompletenessErrorCode,
  CompletenessResult
} from "@/application/ports/completeness-check-port";

/**
 * The completeness findings of wizard step 3 (Feature #402, Task #403 / T1c).
 *
 * It runs `CompletenessCheckPort` once on mount — the wizard mounts it when
 * step 2's valid submit advances — and renders the API's concise list of
 * faltantes/anomalías. The check is real and deterministic, so the section
 * carries no `SIMULADO` marker (only the simulated risk band does). An
 * incomplete result warns (owner decision 2) but never blocks: the parent's
 * «Continuar» stays enabled and the human reviewer decides.
 *
 * Accessibility: each finding is a visible label plus its API `detail`, with an
 * icon; no meaning is carried by colour alone. The loading line carries a
 * visible, `aria-hidden` spinner so the wait reads as «working», but the section
 * still has no live region, so it never competes with the step's single analysis
 * status.
 */

type CompletenessPhase = "loading" | "done" | "error";

interface CompletenessState {
  readonly phase: CompletenessPhase;
  readonly result: CompletenessResult | null;
  /** Sanitized code behind an `error` phase; keeps a 401 apart from a 503. */
  readonly errorCode: CompletenessErrorCode | null;
}

export interface CompletenessFindingsProps {
  readonly port: CompletenessCheckPort;
  /** Stable across renders; the wizard captures it at step 2's submit. */
  readonly input: CompletenessCheckInput;
  /**
   * Called exactly once when the phase leaves `loading` — whether it lands
   * `done` or `error` — so the parent can gate its actions on «the read
   * finished», never on the verdict (an incomplete result still warns without
   * blocking). Optional and backward-compatible: omitting it changes nothing.
   */
  readonly onSettled?: () => void;
}

export function CompletenessFindings({ port, input, onSettled }: CompletenessFindingsProps) {
  const titleId = useId();
  const [state, setState] = useState<CompletenessState>({ phase: "loading", result: null, errorCode: null });
  // Keep the latest callback without making it a dependency: the check must run
  // once per (port, input) pair, never again because the parent re-rendered.
  const onSettledRef = useRef(onSettled);
  const settledRef = useRef(false);

  useEffect(() => {
    onSettledRef.current = onSettled;
  });

  useEffect(() => {
    let cancelled = false;
    // Report the settled read in the same microtask as the phase change, so the
    // parent's actions and the result commit together. The ref guard keeps the
    // contract «invoked exactly once» even if the effect re-runs.
    const settle = () => {
      if (settledRef.current) return;
      settledRef.current = true;
      onSettledRef.current?.();
    };
    // State is set only from the async callback (never synchronously in the
    // effect body): the initial state is already the loading state, and the
    // port/input pair is stable for the life of the step.
    port.check(input).then(
      (outcome) => {
        if (cancelled) return;
        setState(
          outcome.ok
            ? { phase: "done", result: outcome.result, errorCode: null }
            : { phase: "error", result: null, errorCode: outcome.code }
        );
        settle();
      },
      () => {
        if (cancelled) return;
        setState({ phase: "error", result: null, errorCode: "network" });
        settle();
      }
    );
    return () => {
      cancelled = true;
    };
  }, [port, input]);

  const { phase, result, errorCode } = state;
  const notice = result ? completenessNotice(result) : null;

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-card border border-page-border bg-page-surface p-5"
    >
      <h2 id={titleId} className="m-0 text-[15px] font-[650]">
        {COMPLETENESS_COPY.title}
      </h2>

      {phase === "loading" ? (
        <p aria-busy="true" className="m-0 flex items-center gap-2.5 text-sm text-text-secondary">
          <IoSyncOutline
            aria-hidden="true"
            focusable="false"
            className="shrink-0 animate-spin text-[18px] text-brand-accent-text motion-reduce:animate-none"
          />
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
          {completenessErrorMessage(errorCode ?? "unavailable")}
        </p>
      ) : null}
    </section>
  );
}
