"use client";

import { useState } from "react";
import type { IconType } from "react-icons";
import {
  IoAlertCircleOutline,
  IoAnalyticsOutline,
  IoArrowForwardOutline,
  IoCheckmarkCircleOutline,
  IoCubeOutline,
  IoDocumentTextOutline,
  IoHourglassOutline,
  IoPersonOutline,
  IoWalletOutline
} from "react-icons/io5";
import { submitSmeRequest } from "@/application/evidence/submit-sme-request";
import { ensureMyBusiness } from "@/application/pyme-onboarding/business-persistence";
import {
  connectAndStoreWallet,
  walletConnectFailureCopy
} from "@/application/pyme-onboarding/wallet-connection";
import {
  REVIEW_STEP_COPY,
  reviewNextSteps,
  smeReferenceFor,
  toSmeRequestValues,
  type ReviewStepIcon,
  type ReviewStepTone
} from "@/application/pyme-onboarding/review-step";
import type { RegistrationValues } from "@/application/pyme-onboarding/registration-step";
import type { BusinessPort } from "@/application/ports/business-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import type { WalletConnection, WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { createBrowserWalletConnectionPort } from "@/infrastructure/wallet/create-wallet-connection-port";
import { FOCUS_RING } from "../auth-field";

/**
 * Step 4 «Revisión humana» of the onboarding wizard (Feature #398, Task #399 /
 * T5). The PyME reviews what it loaded, connects Freighter (mandatory: its
 * public key is the vault's immutable destination) and itself presses «Enviar
 * a revisión» (owner decision D12). The send goes through the existing
 * SME-request engine; a successful send shows «Revisión humana» as «En proceso»
 * and the green confirmation with «Ir a Mi campaña».
 *
 * The wallet is behind the existing `WalletPort` (real Freighter is #406); the
 * vault deploy is platform-signed and the PyME signs nothing here.
 *
 * T1c (#407): connecting does not just remember a key locally. `connectWallet`
 * runs `connectAndStoreWallet` — connect, request the API challenge, sign its
 * message and submit the signature — so the send gate keys on a STORED
 * connection. A persistence failure shows a sanitized message and blocks the
 * send; the vault's destination must already be persisted server-side.
 *
 * T3c: when the send fires it first ensures the sign-in principal owns a
 * company (`getMyBusiness`, then `createBusiness` only on `not_found`) and only
 * then submits the SME request. A company failure shows a sanitized message and
 * submits nothing; a pre-existing company is reused, never duplicated. The
 * owner is resolved by the API from the session, so it is never sent here.
 */

const STEP_ICONS: Readonly<Record<ReviewStepIcon, IconType>> = {
  document: IoDocumentTextOutline,
  check: IoCheckmarkCircleOutline,
  analytics: IoAnalyticsOutline,
  wallet: IoWalletOutline,
  person: IoPersonOutline,
  cube: IoCubeOutline
};

const TONE_ROW: Readonly<Record<ReviewStepTone, string>> = {
  ok: "border border-page-border",
  none: "border border-page-border",
  warn: "border border-transparent bg-trust-caution-surface",
  err: "border border-transparent bg-trust-critical-surface"
};

const TONE_STATE: Readonly<Record<ReviewStepTone, string>> = {
  ok: "text-trust-success",
  none: "text-text-secondary",
  warn: "text-trust-caution",
  err: "text-trust-critical"
};

type SendPhase = "idle" | "sending" | "sent";

export interface ReviewStepProps {
  readonly wallet: WalletPort;
  readonly gateway: SmeRequestGateway | null;
  /** Company persistence; the wizard injects the browser port, tests a double. */
  readonly business: BusinessPort;
  /** Wallet persistence; defaults to the browser port, tests inject a double. */
  readonly connection?: WalletConnectionPort;
  readonly values: RegistrationValues;
  /** «Revisar lo cargado»: return to step 2. */
  readonly onEdit: () => void;
  /** «Ir a Mi campaña»: leave the wizard (the `/company` dashboard). */
  readonly onDone: () => void;
}

export function ReviewStep({ wallet, gateway, business, connection, values, onEdit, onDone }: ReviewStepProps) {
  const [browserConnection] = useState<WalletConnectionPort>(() => createBrowserWalletConnectionPort());
  const connectionPort = connection ?? browserConnection;
  const [stored, setStored] = useState<WalletConnection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletTried, setWalletTried] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [sendPhase, setSendPhase] = useState<SendPhase>("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  const sent = sendPhase === "sent";
  const walletConnected = stored !== null;
  const steps = reviewNextSteps({ sent, walletConnected, walletTried, publicKey: stored?.publicKey ?? null });

  async function connectWallet(): Promise<void> {
    if (connecting) return;
    setConnecting(true);
    setConnectError(null);
    const outcome = await connectAndStoreWallet(wallet, connectionPort);
    if (outcome.ok) {
      setStored(outcome.connection);
    } else {
      setConnectError(walletConnectFailureCopy(outcome));
    }
    setConnecting(false);
  }

  async function sendReview(): Promise<void> {
    if (sendPhase !== "idle") return;
    // The send gate keys on the STORED connection, not a component-local key:
    // the vault's destination must already be persisted server-side.
    if (!stored) {
      setWalletTried(true);
      return;
    }
    setSendError(null);
    if (!gateway) {
      setSendError(REVIEW_STEP_COPY.sendUnavailable);
      return;
    }
    setSendPhase("sending");
    const company = await ensureMyBusiness(business, values);
    if (!company.ok) {
      setSendPhase("idle");
      setSendError(REVIEW_STEP_COPY.businessFailed);
      return;
    }
    const result = await submitSmeRequest(gateway, toSmeRequestValues(values), smeReferenceFor(values));
    if (result.ok) {
      setSendPhase("sent");
      return;
    }
    setSendPhase("idle");
    setSendError(result.error.message ?? REVIEW_STEP_COPY.sendFailed);
  }

  return (
    <section aria-label="Revisión humana" className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
      {sent ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-card bg-trust-caution-surface p-4 text-trust-caution"
        >
          <IoHourglassOutline aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[22px]" />
          <div className="text-sm leading-normal">
            <strong className="text-[15px] font-[650]">{REVIEW_STEP_COPY.sentBannerTitle}</strong>
            <br />
            {REVIEW_STEP_COPY.sentBannerBody}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-card bg-page-surface p-4">
          <IoDocumentTextOutline
            aria-hidden="true"
            focusable="false"
            className="mt-0.5 shrink-0 text-[22px] text-text-secondary"
          />
          <div className="text-[15px] leading-normal">
            <strong className="font-[650]">{REVIEW_STEP_COPY.notSentTitle}</strong> {REVIEW_STEP_COPY.notSentBody}
          </div>
        </div>
      )}

      <h1 className="m-0 text-[clamp(30px,3.6vw,40px)] leading-[1.15] font-bold tracking-[-0.025em]">
        {REVIEW_STEP_COPY.heading}
      </h1>

      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {steps.map((step) => {
          const StepIcon = STEP_ICONS[step.icon];
          return (
            <li key={step.title} className={`flex items-start gap-3.5 rounded-card p-4 ${TONE_ROW[step.tone]}`}>
              <StepIcon
                aria-hidden="true"
                focusable="false"
                className={`mt-0.5 shrink-0 text-[22px] ${TONE_STATE[step.tone]}`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-[650]">{step.title}</div>
                <div className="text-sm leading-[1.5] text-text-secondary">{step.body}</div>
              </div>
              <span className={`shrink-0 text-xs font-[650] whitespace-nowrap ${TONE_STATE[step.tone]}`}>
                {step.state}
              </span>
            </li>
          );
        })}
      </ol>

      {walletTried && !walletConnected ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-trust-critical-surface px-4 py-3.5 text-trust-critical"
        >
          <span className="flex flex-1 items-center gap-2 text-sm font-semibold">
            <IoAlertCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[18px]" />
            {REVIEW_STEP_COPY.walletAlert}
          </span>
          <button
            type="button"
            onClick={() => void connectWallet()}
            disabled={connecting}
            className={`inline-flex h-11 items-center gap-2 rounded-control border border-trust-critical bg-transparent px-4 text-sm font-[650] text-trust-critical hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            <IoWalletOutline aria-hidden="true" focusable="false" className="text-[18px]" />
            {connecting ? REVIEW_STEP_COPY.connecting : REVIEW_STEP_COPY.connectWallet}
          </button>
        </div>
      ) : null}

      {connectError ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-sm font-semibold text-trust-critical">
          <IoAlertCircleOutline aria-hidden="true" focusable="false" className="text-[18px]" />
          {connectError}
        </p>
      ) : null}

      {sendError ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-sm font-semibold text-trust-critical">
          <IoAlertCircleOutline aria-hidden="true" focusable="false" className="text-[18px]" />
          {sendError}
        </p>
      ) : null}

      {sent ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-trust-success-surface px-4 py-3.5 text-trust-success"
        >
          <span className="flex flex-1 items-center gap-2 text-sm font-semibold">
            <IoCheckmarkCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[18px]" />
            {REVIEW_STEP_COPY.sentSuccess}
          </span>
          <button
            type="button"
            onClick={onDone}
            className={`inline-flex h-11 items-center gap-1.5 rounded-control px-3.5 text-sm font-[650] text-trust-success hover:bg-canvas ${FOCUS_RING}`}
          >
            {REVIEW_STEP_COPY.goToCompany}
            <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-[16px]" />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void sendReview()}
            disabled={sendPhase === "sending"}
            className={`inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-control bg-brand-accent text-base font-[650] text-on-accent hover:bg-brand-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {sendPhase === "sending" ? (
              <span
                aria-hidden="true"
                className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-on-accent/35 border-t-on-accent motion-reduce:animate-none"
              />
            ) : null}
            {sendPhase === "sending" ? REVIEW_STEP_COPY.sending : REVIEW_STEP_COPY.send}
            {sendPhase === "sending" ? null : (
              <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-[18px]" />
            )}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className={`inline-flex h-[52px] items-center justify-center rounded-control border border-control bg-transparent px-4 text-[15px] font-semibold text-text-primary hover:bg-page-surface ${FOCUS_RING}`}
          >
            {REVIEW_STEP_COPY.edit}
          </button>
        </div>
      )}
    </section>
  );
}
