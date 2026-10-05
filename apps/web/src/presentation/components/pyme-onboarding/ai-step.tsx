"use client";

import { useEffect, useId, useState } from "react";
import {
  IoAlertCircleOutline,
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoSpeedometerOutline,
  IoSyncOutline
} from "react-icons/io5";
import { AI_STEP_COPY, riskBandLabel } from "@/application/pyme-onboarding/ai-step";
import type {
  AiEvaluationInput,
  AiEvaluationPort,
  AiEvaluationResult,
  AiRiskBand
} from "@/application/ports/ai-evaluation-port";
import type {
  CompletenessCheckInput,
  CompletenessCheckPort
} from "@/application/ports/completeness-check-port";
import { FOCUS_RING } from "../auth-field";
import { CompletenessFindings } from "./completeness-findings";

/**
 * Step 3 «Evaluación AI» of the onboarding wizard (Feature #398, Task #399 /
 * T5). Runs `AiEvaluationPort` once on mount — the wizard mounts it when step
 * 2's valid submit advances — and renders the template's busy block, then the
 * risk band and the API completeness findings (Feature #402).
 *
 * The band is simulated behind `AiEvaluationPort`; the findings are real and
 * come from `CompletenessCheckPort`. Both are named in text and carry an icon,
 * never colour alone, and an incomplete result warns without blocking: the
 * human review in step 4 decides. «Corregir datos» leaves the evidence
 * untouched and returns to step 2; «Continuar» goes to step 4.
 */

const BAND_TONES: Readonly<Record<AiRiskBand, string>> = {
  low: "bg-trust-success-surface text-trust-success",
  medium: "bg-trust-caution-surface text-trust-caution",
  high: "bg-trust-critical-surface text-trust-critical"
};

type AiPhase = "busy" | "done" | "error";

export interface AiStepProps {
  readonly port: AiEvaluationPort;
  /** Stable across renders; the wizard memoizes it. */
  readonly input: AiEvaluationInput;
  /** The API completeness check (Feature #402). */
  readonly completenessPort: CompletenessCheckPort;
  /** Stable across renders; the wizard captures it at step 2's submit. */
  readonly completenessInput: CompletenessCheckInput;
  /** «Continuar»: advance to step 4 «Revisión humana». */
  readonly onContinue: () => void;
  /** «Corregir datos»: return to step 2. */
  readonly onCorrect: () => void;
}

export function AiStep({
  port,
  input,
  completenessPort,
  completenessInput,
  onContinue,
  onCorrect
}: AiStepProps) {
  const titleId = useId();
  const [phase, setPhase] = useState<AiPhase>("busy");
  const [result, setResult] = useState<AiEvaluationResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    port.evaluate(input).then(
      (evaluation) => {
        if (cancelled) return;
        setResult(evaluation);
        setPhase("done");
      },
      () => {
        if (cancelled) return;
        setPhase("error");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [port, input, attempt]);

  return (
    <section aria-labelledby={titleId} className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-[22px] items-center rounded-pill border border-dashed border-text-secondary px-2 text-[11px] font-[650] tracking-[0.06em] text-text-secondary">
            {AI_STEP_COPY.simulado}
          </span>
        </div>
        <h1
          id={titleId}
          className="m-0 text-[clamp(30px,3.6vw,40px)] leading-[1.15] font-bold tracking-[-0.025em]"
        >
          {AI_STEP_COPY.heading}
        </h1>
        <p className="m-0 max-w-[60ch] text-[16px] leading-[1.55] text-pretty text-text-secondary">
          {AI_STEP_COPY.subtitle}
        </p>
      </div>

      {phase === "busy" ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3.5 rounded-card border border-page-border bg-page-surface p-5"
        >
          <IoSyncOutline
            aria-hidden="true"
            focusable="false"
            className="animate-spin text-2xl text-brand-accent-text motion-reduce:animate-none"
          />
          <div className="text-[15px] leading-normal">
            <strong className="font-[650]">{AI_STEP_COPY.busyTitle}</strong>
            <br />
            <span className="text-text-secondary">{AI_STEP_COPY.busyBody}</span>
          </div>
        </div>
      ) : null}

      {phase === "done" && result ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-page-border bg-page-surface p-5">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-text-secondary">{AI_STEP_COPY.riskLabel}</span>
            <span className="text-[13px] text-text-secondary">{AI_STEP_COPY.riskSubject}</span>
          </div>
          <span
            className={`inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-sm font-[650] ${BAND_TONES[result.riskBand]}`}
          >
            <IoSpeedometerOutline aria-hidden="true" focusable="false" className="text-[16px]" />
            {riskBandLabel(result.riskBand)}
          </span>
        </div>
      ) : null}

      {/* Mounted in parallel with the AI evaluation so its result is ready when
          the band lands, and so the step never shows a fabricated gap. */}
      <CompletenessFindings port={completenessPort} input={completenessInput} />

      {phase === "done" && result ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onContinue}
            className={`inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-control bg-brand-accent text-base font-[650] text-on-accent hover:bg-brand-accent-hover ${FOCUS_RING}`}
          >
            {AI_STEP_COPY.continueLabel}
            <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-[18px]" />
          </button>
          <button
            type="button"
            onClick={onCorrect}
            className={`inline-flex h-[52px] items-center justify-center gap-2 rounded-control border border-control bg-transparent px-4 text-[15px] font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
          >
            <IoArrowBackOutline aria-hidden="true" focusable="false" className="text-[18px]" />
            {AI_STEP_COPY.correctLabel}
          </button>
        </div>
      ) : null}

      {phase === "error" ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-trust-critical-surface p-5 text-trust-critical">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <IoAlertCircleOutline aria-hidden="true" focusable="false" className="text-[19px]" />
            {AI_STEP_COPY.errorMessage}
          </span>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setPhase("busy");
              setAttempt((current) => current + 1);
            }}
            className={`inline-flex h-11 items-center gap-1.5 rounded-control border border-trust-critical bg-transparent px-3 text-[14px] font-[650] text-trust-critical hover:bg-canvas ${FOCUS_RING}`}
          >
            {AI_STEP_COPY.retryLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}
