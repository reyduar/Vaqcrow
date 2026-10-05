"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { IconType } from "react-icons";
import {
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoCheckmarkCircleOutline,
  IoCheckmarkOutline,
  IoCreateOutline,
  IoIdCardOutline,
  IoRefreshOutline,
  IoScanOutline
} from "react-icons/io5";
import {
  KYC_ASIDE_PARAGRAPH_2,
  KYC_DOCUMENT_OPTIONS,
  KYC_PROVIDER_LABEL,
  KYC_STEP_COPY,
  kycPrimaryAction,
  kycPrimaryIcon,
  kycPrimaryLabel,
  kycResultCopy,
  kycSecondaryAction,
  kycSecondaryLabel,
  wizardStepStates,
  type KycPhase,
  type KycPrimaryIcon
} from "@/application/pyme-onboarding/kyc-step";
import { type RegistrationValues } from "@/application/pyme-onboarding/registration-step";
import { smeReferenceFor } from "@/application/pyme-onboarding/review-step";
import type { AiEvaluationInput, AiEvaluationPort } from "@/application/ports/ai-evaluation-port";
import type { BusinessPort } from "@/application/ports/business-port";
import type {
  CompletenessCheckInput,
  CompletenessCheckPort
} from "@/application/ports/completeness-check-port";
import type { KycDocument, KycPort, KycResult } from "@/application/ports/kyc-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import type { UploadPort } from "@/application/ports/upload-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { SimulatedAiEvaluationAdapter } from "@/infrastructure/ai-evaluation/simulated-ai-evaluation-adapter";
import { createBrowserBusinessPort } from "@/infrastructure/business/create-business-port";
import { createBrowserCompletenessPort } from "@/infrastructure/completeness/create-completeness-port";
import { createSmeRequestGateway } from "@/infrastructure/sme/default-gateway";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { FOCUS_RING } from "../auth-field";
import { AiStep } from "./ai-step";
import { RegistrationStep } from "./registration-step";
import { ReviewStep } from "./review-step";

/** Module-scope defaults stay stable across renders, like the other workspaces. */
const defaultAi: AiEvaluationPort = new SimulatedAiEvaluationAdapter();
const defaultWallet: WalletPort = new FreighterWallet();
const defaultGateway = createSmeRequestGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);

const PRIMARY_ICONS: Readonly<Record<KycPrimaryIcon, IconType>> = {
  scan: IoScanOutline,
  "arrow-forward": IoArrowForwardOutline,
  refresh: IoRefreshOutline
};

const BUTTON_BASE =
  "inline-flex w-full items-center justify-center rounded-control font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

export interface PymeOnboardingWizardProps {
  readonly kyc: KycPort;
  /** Upload capability for step 2; optional so tests can inject a double. */
  readonly upload?: UploadPort;
  /** AI evaluation for step 3; optional so tests can inject a double. */
  readonly ai?: AiEvaluationPort;
  /** API completeness check for step 3; optional so tests can inject a double. */
  readonly completeness?: CompletenessCheckPort;
  /** Wallet capability for step 4; optional so tests can inject a double. */
  readonly wallet?: WalletPort;
  /** SME-request engine for step 4's send; `null` forces «no backend». */
  readonly gateway?: SmeRequestGateway | null;
  /** Company persistence for step 4's send; optional so tests can inject a double. */
  readonly business?: BusinessPort;
  /** «Volver» returns to the `/company` dashboard skeleton; the URL never changes. */
  readonly onBack: () => void;
}

/**
 * The PyME registration wizard, rendered inside `/company` with no route of
 * its own (owner decision; `docs/design/demo-ui.md` §4). T1 shipped the shell
 * — «Volver», the four-step stepper and step 1 «Verificación de identidad» —
 * with the KYC verification behind `KycPort`. T2 adds step 2 «Registrá tu
 * PyME»: an approved KYC's «Siguiente paso» advances `stepIndex`, and the
 * stepper re-renders from `wizardStepStates(stepIndex)` so step 1 shows done
 * and step 2 carries `aria-current="step"`. Steps 3–4 are later units.
 *
 * «Volver» stays visible on step 2 too. Registered deviation: the template
 * only draws it on the KYC step, but this wizard has no route of its own, so
 * hiding it would trap the person inside step 2 with no way back to `/company`.
 *
 * Copy is verbatim from `Vaqcrow Onboarding PyME.dc.html`. The 52 px CTAs and
 * the 48 px native `select` follow the template; the shared `Button`/`Select`
 * primitives are fixed at 44 px and the `Select` renders a popover listbox,
 * so this screen uses native controls with the repo's Tailwind tokens (the
 * `AuthField` deviation, recorded in `odd/tasks/account-creation-sign-in-role-shell.md`).
 */
export function PymeOnboardingWizard({
  kyc,
  upload,
  ai = defaultAi,
  completeness,
  wallet = defaultWallet,
  gateway = defaultGateway,
  business,
  onBack
}: PymeOnboardingWizardProps) {
  const titleId = useId();
  const documentId = useId();
  const [stepIndex, setStepIndex] = useState(0);
  const [document, setDocument] = useState<KycDocument>("person_a");
  const [phase, setPhase] = useState<KycPhase>("idle");
  const [result, setResult] = useState<KycResult | null>(null);
  const [registration, setRegistration] = useState<RegistrationValues | null>(null);
  const [completenessInput, setCompletenessInput] = useState<CompletenessCheckInput | null>(null);
  // Built per mount (like `CompanyWorkspace`'s upload port) so SSR never touches
  // the browser env or the Supabase client.
  const [browserBusiness] = useState<BusinessPort>(() => createBrowserBusinessPort());
  const [browserCompleteness] = useState<CompletenessCheckPort>(() => createBrowserCompletenessPort());
  const requestRef = useRef(0);

  const businessPort = business ?? browserBusiness;
  const completenessPort = completeness ?? browserCompleteness;

  const outcome = result?.outcome ?? null;
  const busy = phase === "busy";
  const done = kycResultCopy(phase, result);
  const steps = wizardStepStates(stepIndex);
  const PrimaryIcon = PRIMARY_ICONS[kycPrimaryIcon(phase, outcome)];
  const aiInput = useMemo<AiEvaluationInput | null>(
    () => (registration ? { smeReference: smeReferenceFor(registration), sales: registration.sales } : null),
    [registration]
  );

  async function verify() {
    if (busy) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    setResult(null);
    setPhase("busy");
    try {
      const verified = await kyc.verify({ document });
      if (requestRef.current !== request) return;
      setResult(verified);
      setPhase("done");
    } catch {
      if (requestRef.current !== request) return;
      // No error screen is designed for KYC; returning to idle lets the person
      // retry without inventing copy or a dead end.
      setPhase("idle");
    }
  }

  function chooseAnother() {
    requestRef.current += 1;
    setResult(null);
    setPhase("idle");
  }

  function onPrimary() {
    const action = kycPrimaryAction(phase, outcome);
    if (action === "verify") void verify();
    else if (action === "retry") chooseAnother();
    else setStepIndex(1);
  }

  function onSecondary() {
    if (kycSecondaryAction(phase) === "verify") void verify();
    else chooseAnother();
  }

  return (
    <div lang="es" className="flex flex-col gap-10">
      <div className="flex w-full flex-col items-start gap-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver a la pantalla anterior"
          className={`-ml-2 inline-flex h-11 items-center gap-1.5 rounded-control pr-3 pl-2 text-sm font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
        >
          <IoArrowBackOutline aria-hidden="true" focusable="false" className="text-lg" />
          Volver
        </button>

        <ol
          aria-label="Pasos del registro"
          className="m-0 flex w-full max-w-[760px] list-none items-center gap-3 self-center p-0"
        >
          {steps.map((step) => (
            <li
              key={step.id}
              aria-current={step.current ? "step" : undefined}
              className="flex min-w-0 items-center gap-2.5"
              style={{ flex: step.n < steps.length ? "1 1 0" : "0 0 auto" }}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-pill text-sm font-bold ${
                  step.done
                    ? "bg-brand-accent text-on-accent"
                    : step.current
                      ? "border-2 border-brand-accent-text text-brand-accent-text"
                      : "border border-control text-text-secondary"
                }`}
              >
                {step.done ? (
                  <IoCheckmarkOutline aria-hidden="true" focusable="false" className="text-lg" />
                ) : (
                  step.n
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[11px] font-[650] tracking-[0.06em] text-text-secondary">PASO {step.n}</span>
                <span className={`text-sm whitespace-nowrap ${step.current ? "font-bold" : "font-medium"}`}>
                  {step.label}
                </span>
              </span>
              {step.n < steps.length ? (
                <span
                  aria-hidden="true"
                  className={`h-0.5 min-w-6 flex-1 rounded-pill ${step.done ? "bg-brand-accent" : "bg-page-border"}`}
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {stepIndex === 0 ? (
        <div className="flex flex-wrap items-start justify-center gap-8">
        <section aria-labelledby={titleId} className="flex max-w-[720px] min-w-0 flex-[999_1_520px] flex-col gap-6">
          <div className="flex flex-col items-center gap-2.5 text-center">
            <h1 id={titleId} className="m-0 text-[clamp(34px,4.4vw,48px)] leading-[1.08] font-bold tracking-[-0.03em]">
              {KYC_STEP_COPY.heading}
            </h1>
            <p className="m-0 max-w-[52ch] text-[17px] leading-[1.55] text-pretty text-text-secondary">
              {KYC_STEP_COPY.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-5 rounded-panel border border-page-border bg-raised p-6">
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3.5 rounded-card border-2 border-dashed border-control px-5 py-8 text-center">
              {phase === "idle" ? (
                <>
                  <span className="grid h-16 w-16 place-items-center rounded-card bg-brand-accent-tint text-brand-accent-text">
                    <IoIdCardOutline aria-hidden="true" focusable="false" className="text-[32px]" />
                  </span>
                  <div className="text-[17px] font-[650]">{KYC_STEP_COPY.dropzoneTitle}</div>
                  <p className="m-0 max-w-[44ch] text-sm text-text-secondary">{KYC_STEP_COPY.dropzoneBody}</p>
                  <label htmlFor={documentId} className="flex w-full max-w-[360px] flex-col gap-1.5 text-left">
                    <span className="text-sm font-semibold">{KYC_STEP_COPY.documentLabel}</span>
                    <select
                      id={documentId}
                      value={document}
                      onChange={(event) => setDocument(event.target.value as KycDocument)}
                      className="h-12 w-full rounded-control border border-control bg-canvas px-3.5 text-[15px] text-text-primary"
                    >
                      {KYC_DOCUMENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}

              {busy ? (
                <div role="status" className="flex flex-col items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="h-9 w-9 animate-spin rounded-full border-[3px] border-page-border border-t-brand-accent motion-reduce:animate-none"
                  />
                  <div className="text-base font-[650]">{KYC_STEP_COPY.busyTitle}</div>
                  <span className="text-[13px] text-text-secondary">{KYC_PROVIDER_LABEL}</span>
                </div>
              ) : null}

              {done ? (
                <>
                  <div
                    role="status"
                    className={`flex w-full max-w-[440px] flex-col items-center gap-2.5 rounded-card px-5 py-4 ${
                      done.tone === "approved"
                        ? "bg-trust-success-surface text-trust-success"
                        : "bg-trust-caution-surface text-trust-caution"
                    }`}
                  >
                    {done.tone === "approved" ? (
                      <IoCheckmarkCircleOutline aria-hidden="true" focusable="false" className="text-[30px]" />
                    ) : (
                      <IoCreateOutline aria-hidden="true" focusable="false" className="text-[30px]" />
                    )}
                    <div className="text-[17px] font-bold">{done.title}</div>
                    <span className="text-sm leading-[1.5]">{done.body}</span>
                  </div>
                  <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-left text-[13px]">
                    <dt className="text-text-secondary">{KYC_STEP_COPY.referenceLabel}</dt>
                    <dd className="m-0 font-mono">{result?.reference}</dd>
                    <dt className="text-text-secondary">{KYC_STEP_COPY.providerLabel}</dt>
                    <dd className="m-0">{result?.provider}</dd>
                  </dl>
                </>
              ) : null}
            </div>

            <p className="m-0 text-center text-[13px] text-text-secondary">{microcopy.kycSimulated}</p>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              <button
                type="button"
                onClick={onPrimary}
                disabled={busy}
                className={`${BUTTON_BASE} h-[52px] gap-2 bg-brand-accent text-base font-[650] text-on-accent hover:bg-brand-accent-hover ${FOCUS_RING}`}
              >
                <PrimaryIcon aria-hidden="true" focusable="false" className="text-[19px]" />
                {kycPrimaryLabel(phase, outcome)}
              </button>
              <button
                type="button"
                onClick={onSecondary}
                disabled={busy}
                className={`${BUTTON_BASE} h-[52px] border border-control bg-transparent text-[15px] text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
              >
                {kycSecondaryLabel(phase)}
              </button>
            </div>
          </div>
        </section>

        <aside className="flex max-w-[340px] min-w-0 flex-[1_1_260px] flex-col gap-3 rounded-card border border-page-border p-5">
          <span className="text-xs font-[650] tracking-[0.06em] text-brand-accent-text">
            {KYC_STEP_COPY.asideTitle}
          </span>
          <p className="m-0 text-sm leading-[1.55]">{KYC_STEP_COPY.asideParagraph1}</p>
          <p className="m-0 text-sm leading-[1.55] text-text-secondary">
            {KYC_ASIDE_PARAGRAPH_2.lead}
            <strong className="font-[650] text-text-primary">{KYC_ASIDE_PARAGRAPH_2.emphasis}</strong>
            {KYC_ASIDE_PARAGRAPH_2.tail}
          </p>
        </aside>
        </div>
      ) : null}

      {stepIndex >= 1 ? (
        <div hidden={stepIndex !== 1}>
          <RegistrationStep
            upload={upload}
            onSubmit={(values, evidence) => {
              setRegistration(values);
              setCompletenessInput(evidence);
              setStepIndex(2);
            }}
          />
        </div>
      ) : null}

      {stepIndex === 2 && aiInput && completenessInput ? (
        <AiStep
          port={ai}
          input={aiInput}
          completenessPort={completenessPort}
          completenessInput={completenessInput}
          onContinue={() => setStepIndex(3)}
          onCorrect={() => setStepIndex(1)}
        />
      ) : null}

      {stepIndex === 3 && registration ? (
        <ReviewStep
          wallet={wallet}
          gateway={gateway}
          business={businessPort}
          values={registration}
          onEdit={() => setStepIndex(1)}
          onDone={onBack}
        />
      ) : null}
    </div>
  );
}
