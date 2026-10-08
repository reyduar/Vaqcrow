"use client";

import { useId } from "react";
import type { IconType } from "react-icons";
import {
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoCreateOutline,
  IoDocumentTextOutline,
  IoPersonOutline
} from "react-icons/io5";
import { AlertDialog } from "@heroui/react";
import type { HumanDecisionRecord } from "@vaqcrow/contracts";
import {
  DECISION_COPY,
  DECISION_OPTIONS,
  DECISION_REASON_MAX_LENGTH,
  decisionConfirmationBody,
  decisionOutcomeLabel,
  decisionStateIsFinal,
  decisionStatusLine,
  formatApprovedLimit,
  type DecisionOptionIcon,
  type DecisionOptionTone
} from "@/application/admin/decision";
import type { AdminReviewContext, AdminReviewPort } from "@/application/ports/admin-review-port";
import { useAdminDecision } from "@/state/use-admin-decision";
import { Button } from "../button";

const FOCUS_RING =
  "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus-ring";

const OPTION_ICONS: Readonly<Record<DecisionOptionIcon, IconType>> = {
  check: IoCheckmarkCircleOutline,
  edit: IoCreateOutline,
  close: IoCloseCircleOutline
};

/** The template's `fg` per option: ok / info / err text tones (icon only, never the only signal). */
const OPTION_TONE: Readonly<Record<DecisionOptionTone, string>> = {
  success: "text-trust-success",
  info: "text-trust-info",
  critical: "text-trust-critical"
};

const FIELD_CLASS =
  "rounded-control border bg-canvas px-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export interface DecisionSectionProps {
  readonly context: AdminReviewContext;
  readonly reload: () => void;
  readonly port: AdminReviewPort;
  /** The signed-in admin's display name, for the confirmation; `null` keeps the copy truthful without it. */
  readonly adminName: string | null;
}

/**
 * Section «3 · Decisión humana» of the admin review (`Vaqcrow Admin.dc.html`,
 * view `review`; #410 / U5): a person chooses the outcome, writes a reason
 * (10–1000 characters) and confirms in an `alertdialog`. The approved limit is
 * the PyME's declared goal, read-only (D7). Once a decision exists the section
 * is read-only and shows the server's record; the actor always comes from the
 * server, never from this form.
 */
export function DecisionSection({ context, reload, port, adminName }: DecisionSectionProps) {
  const ids = useId();
  const decision = useAdminDecision(port, context, reload);
  const readOnly = decision.recorded !== null || decisionStateIsFinal(context.state);

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="flex flex-col gap-3.5 rounded-card border-2 border-text-primary p-[22px] text-text-primary"
    >
      <div className="flex items-center gap-2">
        <IoPersonOutline aria-hidden="true" focusable="false" className="text-xl" />
        <h2 id={`${ids}-title`} className="m-0 text-lg font-bold">
          {DECISION_COPY.title}
        </h2>
      </div>
      <p className="m-0 text-sm leading-normal">{DECISION_COPY.notice}</p>

      {readOnly ? (
        <RecordedDecision record={decision.recorded} />
      ) : (
        <DecisionForm decision={decision} ids={ids} />
      )}

      {decision.message ? (
        <p role="alert" className="m-0 text-sm text-text-primary">
          {decision.message}
        </p>
      ) : null}

      <AlertDialog.Backdrop
        isOpen={decision.confirming !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) decision.cancel();
        }}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog className="flex max-w-[440px] flex-col gap-3.5 rounded-[20px] bg-raised p-6">
            <AlertDialog.Header>
              <AlertDialog.Heading className="m-0 text-xl font-bold">{DECISION_COPY.dialogTitle}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="m-0 text-sm leading-normal text-text-secondary">
                {decision.confirming ? decisionConfirmationBody(decision.confirming, adminName) : null}
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="flex justify-end gap-2.5">
              <Button variant="ghost" onPress={decision.cancel}>
                {DECISION_COPY.cancel}
              </Button>
              <Button onPress={() => void decision.confirm()}>{DECISION_COPY.confirm}</Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </section>
  );
}

function DecisionForm({ decision, ids }: { decision: ReturnType<typeof useAdminDecision>; ids: string }) {
  const disabled = !decision.open || decision.submitting;
  const outcomeErrorId = `${ids}-outcome-error`;
  const approvalNoteId = `${ids}-approval-note`;
  const reasonErrorId = `${ids}-reason-error`;
  const limitHintId = `${ids}-limit-hint`;
  const approvalImpossible = decision.approvedLimitArs === null;

  return (
    <>
      {!decision.open ? <p className="m-0 text-sm text-text-secondary">{DECISION_COPY.formClosed}</p> : null}

      <div
        role="radiogroup"
        aria-label={DECISION_COPY.groupLabel}
        aria-invalid={decision.errors.outcome ? "true" : undefined}
        aria-describedby={decision.errors.outcome ? outcomeErrorId : undefined}
        className="grid gap-2"
      >
        {DECISION_OPTIONS.map((option) => {
          const Icon = OPTION_ICONS[option.icon];
          const optionDisabled = disabled || (option.value === "approved" && approvalImpossible);
          return (
            <label
              key={option.value}
              className={`flex h-[46px] cursor-pointer items-center gap-2.5 rounded-control border border-control px-3.5 text-[15px] font-semibold has-[input:checked]:border-2 has-[input:checked]:border-brand-accent-text has-[input:checked]:bg-brand-accent-tint has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60 ${FOCUS_RING}`}
            >
              <input
                type="radio"
                name={`${ids}-outcome`}
                value={option.value}
                checked={decision.outcome === option.value}
                disabled={optionDisabled}
                onChange={() => decision.setOutcome(option.value)}
                aria-describedby={option.value === "approved" && approvalImpossible ? approvalNoteId : undefined}
                className="sr-only"
              />
              <Icon aria-hidden="true" focusable="false" className={`text-[19px] ${OPTION_TONE[option.tone]}`} />
              {option.label}
            </label>
          );
        })}
      </div>
      {approvalImpossible ? (
        <p id={approvalNoteId} className="m-0 text-[13px] text-text-secondary">
          {DECISION_COPY.approvalUnavailable}
        </p>
      ) : null}
      {decision.errors.outcome ? (
        <p id={outcomeErrorId} className="m-0 text-[13px] text-trust-critical">
          {decision.errors.outcome}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{DECISION_COPY.reasonLabel}</span>
        <textarea
          rows={3}
          value={decision.reason}
          maxLength={DECISION_REASON_MAX_LENGTH}
          disabled={disabled}
          placeholder={DECISION_COPY.reasonPlaceholder}
          onChange={(event) => decision.setReason(event.target.value)}
          aria-invalid={decision.errors.reason ? "true" : "false"}
          aria-describedby={decision.errors.reason ? reasonErrorId : undefined}
          className={`${FIELD_CLASS} resize-y py-2.5 ${decision.errors.reason ? "border-2 border-trust-critical" : "border-control"} disabled:opacity-60`}
        />
      </label>
      {decision.errors.reason ? (
        <p id={reasonErrorId} className="m-0 text-[13px] text-trust-critical">
          {decision.errors.reason}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{DECISION_COPY.limitLabel}</span>
        <input
          type="text"
          readOnly
          aria-readonly="true"
          value={approvalImpossible ? DECISION_COPY.limitMissing : formatApprovedLimit(decision.approvedLimitArs ?? 0)}
          aria-describedby={limitHintId}
          className={`${FIELD_CLASS} h-11 border-control bg-page-surface text-right font-[650]`}
        />
      </label>
      <p id={limitHintId} className="m-0 text-[13px] text-text-secondary">
        {DECISION_COPY.limitHint}
      </p>

      <Button
        fullWidth
        className="h-[50px]"
        isDisabled={disabled}
        isLoading={decision.submitting}
        loadingLabel={DECISION_COPY.submitting}
        onPress={decision.requestConfirmation}
      >
        {DECISION_COPY.submit}
      </Button>
    </>
  );
}

function RecordedDecision({ record }: { record: HumanDecisionRecord | null }) {
  if (record === null) {
    return (
      <p role="status" className="m-0 rounded-control bg-page-surface p-3 text-[13px] leading-[1.45]">
        {DECISION_COPY.decidedWithoutRecord}
      </p>
    );
  }
  return (
    <>
      <div role="status" className="flex gap-2 rounded-control bg-page-surface p-3 text-[13px] leading-[1.45]">
        <IoDocumentTextOutline aria-hidden="true" focusable="false" className="shrink-0 text-lg" />
        <span>{decisionStatusLine(record)}</span>
      </div>
      <dl className="m-0 grid gap-2 text-sm">
        <div>
          <dt className="font-semibold">{DECISION_COPY.groupLabel}</dt>
          <dd className="m-0">{decisionOutcomeLabel(record.outcome)}</dd>
        </div>
        <div>
          <dt className="font-semibold">{DECISION_COPY.reasonLabel}</dt>
          <dd className="m-0 whitespace-pre-line break-words">{record.reason}</dd>
        </div>
        {record.approvedLimitArs !== null ? (
          <div>
            <dt className="font-semibold">{DECISION_COPY.limitLabel}</dt>
            <dd className="m-0">{formatApprovedLimit(record.approvedLimitArs)}</dd>
          </div>
        ) : null}
      </dl>
    </>
  );
}
