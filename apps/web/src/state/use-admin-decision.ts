"use client";

import { useState } from "react";
import type { HumanDecisionOutcome, HumanDecisionRecord } from "@vaqcrow/contracts";
import {
  approvedLimitFor,
  buildDecisionRequest,
  decisionFailureMessage,
  decisionFingerprint,
  decisionFormOpen,
  validateDecision,
  type DecisionField,
  type DecisionInput
} from "@/application/admin/decision";
import type { AdminReviewContext, AdminReviewPort } from "@/application/ports/admin-review-port";

/**
 * Client state of section «3 · Decisión humana» (Feature #410 / U5).
 *
 * «Registrar decisión» validates and opens the confirmation; only «Confirmar»
 * writes. Each confirmed submission gets one client UUID v4, reused when the
 * same submission is retried after an unconfirmed result (503/network) so the
 * API answers a replay instead of recording twice; any other outcome or an
 * edited payload gets a fresh id. A success shows the server's own record at
 * once and re-reads the context; the recorded decision in the re-read context
 * always wins afterwards. A failure keeps the form and claims nothing.
 */

interface PendingSubmission {
  readonly fingerprint: string;
  readonly decisionId: string;
}

export interface AdminDecisionState {
  /** Form visible and editable: `human_review` without a recorded decision. */
  readonly open: boolean;
  /** The decision to show read-only, if any. */
  readonly recorded: HumanDecisionRecord | null;
  readonly outcome: HumanDecisionOutcome | null;
  readonly reason: string;
  readonly approvedLimitArs: number | null;
  readonly errors: Readonly<Partial<Record<DecisionField, string>>>;
  readonly confirming: DecisionInput | null;
  readonly submitting: boolean;
  readonly message: string | null;
  readonly setOutcome: (outcome: HumanDecisionOutcome) => void;
  readonly setReason: (reason: string) => void;
  readonly requestConfirmation: () => void;
  readonly cancel: () => void;
  readonly confirm: () => Promise<void>;
}

export function useAdminDecision(
  port: AdminReviewPort,
  context: AdminReviewContext,
  reload: () => void,
  newDecisionId: () => string = () => crypto.randomUUID()
): AdminDecisionState {
  const [outcome, setOutcomeState] = useState<HumanDecisionOutcome | null>(null);
  const [reason, setReasonState] = useState("");
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState<DecisionInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSubmission | null>(null);
  const [written, setWritten] = useState<HumanDecisionRecord | null>(null);

  const approvedLimitArs = approvedLimitFor(context.company);
  const recorded = context.latestHumanDecision ?? written;
  const open = recorded === null && decisionFormOpen(context.state, context.latestHumanDecision);
  const validation = validateDecision({ outcome, reason, approvedLimitArs });
  const errors = tried && !validation.ok ? validation.errors : {};

  function setOutcome(next: HumanDecisionOutcome): void {
    if (!open || submitting) return;
    if (next === "approved" && approvedLimitArs === null) return;
    setOutcomeState(next);
  }

  function setReason(next: string): void {
    if (!open || submitting) return;
    setReasonState(next);
  }

  function requestConfirmation(): void {
    if (!open || submitting) return;
    setTried(true);
    if (validation.ok) setConfirming(validation.input);
  }

  function cancel(): void {
    setConfirming(null);
  }

  async function confirm(): Promise<void> {
    if (confirming === null || submitting) return;
    const input = confirming;
    const fingerprint = decisionFingerprint(input);
    const decisionId = pending?.fingerprint === fingerprint ? pending.decisionId : newDecisionId();
    setPending({ fingerprint, decisionId });
    setConfirming(null);
    setSubmitting(true);
    setMessage(null);
    const result = await port.recordDecision(context.applicationId, buildDecisionRequest(decisionId, input));
    setSubmitting(false);

    if (result.ok) {
      setPending(null);
      setWritten(result.decision);
      reload();
      return;
    }
    setMessage(decisionFailureMessage(result));
    // Only an unconfirmed outcome may already be recorded: its retry keeps the id.
    if (result.code !== "unavailable" && result.code !== "network") setPending(null);
    if (result.code === "state_conflict" || result.code === "not_found") reload();
  }

  return {
    open,
    recorded,
    outcome,
    reason,
    approvedLimitArs,
    errors,
    confirming,
    submitting,
    message,
    setOutcome,
    setReason,
    requestConfirmation,
    cancel,
    confirm
  };
}
