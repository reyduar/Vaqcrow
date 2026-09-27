"use client";

import { useState } from "react";
import { Checkbox, Modal } from "@heroui/react";
import { disclosures, microcopy } from "@/application/trust/disclosures";
import { Badge } from "./badge";
import { Button } from "./button";
import { CanonicalDisclosure } from "./canonical-disclosure";
import { truncateMiddle } from "./hash-display";

/**
 * TransactionReviewModal (Issue #321 / T1): the shared "Revisión antes de
 * firmar" overlay — `claude-design-brief.md:218`'s rule that no action opens
 * Freighter without a legible intent and an explicit confirmation. Every
 * value, state and handler is a prop: this component never talks to a
 * wallet, builds/decodes XDR, or knows about the network. A `signing-status`
 * of `"signature-rejected"` or `"verification-rejected"` never renders as
 * confirmed — there is no confirmed/success state here at all; that belongs
 * to whatever screen owns the post-submit result.
 */
export type TransactionReviewSigningStatus =
  | "idle"
  | "signing"
  | "signature-rejected"
  | "verification-rejected";

/**
 * Discriminated so a rejected signing status can never be constructed
 * without its visible reason — same pattern as `TransactionReviewNetworkState`
 * below. Native review advisory R3-silent-rejection (2026-09-27): before this
 * fix, `signingStatus: "signature-rejected"` (or `"verification-rejected"`)
 * with no `signingErrorMessage` rendered nothing and left signing enabled —
 * indistinguishable from an untouched idle modal.
 */
export type TransactionReviewSigningState =
  | { readonly signingStatus: "idle" | "signing" }
  | {
      readonly signingStatus: "signature-rejected" | "verification-rejected";
      readonly signingErrorMessage: string;
    };

export interface TransactionReviewDescriptionRow {
  readonly label: string;
  readonly value: string;
  /**
   * Middle-truncates the value, keeps the full value available to
   * assistive tech, and renders a copy control — without a per-row TESTNET
   * badge (unlike `HashDisplay`, which this deliberately does not reuse
   * here; see the task log). Use this for public keys / contract ids; leave
   * it unset for short plain values.
   */
  readonly mono?: boolean;
}

/**
 * Discriminated so a caller can never pass `isWrongNetwork: true` without a
 * visible reason: an earlier version made `wrongNetworkMessage` independently
 * optional, which let signing be silently blocked with no explanation on
 * screen (parent readback finding #3, 2026-09-27).
 *
 * The type alone doesn't stop a caller from passing `wrongNetworkMessage: ""`
 * or a rejected `signingErrorMessage: ""` (a non-empty-string type would
 * reject legitimate whitespace/edge content too, and TypeScript has no
 * built-in non-empty-string type) — native review advisory
 * R3-empty-wrong-network-message (2026-09-27) found exactly that gap. A first
 * fix only gated the alert element on `isWrongNetwork`/the rejected status
 * rather than the message's truthiness, so the alert was never silently
 * dropped — but parent readback correctly called this vacuous for the
 * wrong-network case: an empty `<p role="alert">` still shows the user no
 * reason. No `application/trust` constant fit at the time
 * (`disclosures.testnet` is a general Testnet blurb, `microcopy.preSignCheck`
 * is a pre-sign checklist — neither says signing is currently blocked), so
 * the owner authorized exactly one new one for this exact condition:
 * `microcopy.wrongNetwork` ("Cambia a Stellar Testnet para continuar",
 * `demo-ui.md:1173`). `wrongNetworkMessage` below falls back to it when the
 * caller's string is blank or whitespace-only. No equivalent fallback was
 * authorized for a rejected signing status: `rejectedMessage` has no
 * fallback, so a caller passing `signingErrorMessage: ""` still gets a
 * visually empty (though present, `role="alert"`) element — a documented
 * residual limitation, not a fix.
 */
export type TransactionReviewNetworkState =
  | { readonly isWrongNetwork?: false }
  | { readonly isWrongNetwork: true; readonly wrongNetworkMessage: string };

interface TransactionReviewModalBaseProps {
  /** Fired on Escape, backdrop dismiss, "Cancelar" and the close button. */
  readonly onClose: () => void;
  /** Fired when "Firmar en Freighter" is pressed while enabled. */
  readonly onSign: () => void;
  readonly title: string;
  /** Rendered as passed — this component performs no formatting or math. */
  readonly amount: string;
  readonly assetCode: string;
  readonly descriptionRows: readonly TransactionReviewDescriptionRow[];
  /**
   * Presence renders the acknowledgement checkbox and makes it required
   * before signing is enabled; absence renders no checkbox at all. Its
   * label is caller-supplied: not part of `application/trust`'s canonical
   * copy (recorded deviation in `odd/tasks/transaction-review-modal.md`).
   */
  readonly acknowledgementLabel?: string;
}

/**
 * Declared as its own intersection (rather than deriving the content props
 * from `TransactionReviewModalProps` via `Omit`) so the `isWrongNetwork` /
 * `wrongNetworkMessage` and `signingStatus` / `signingErrorMessage`
 * discriminants survive object-rest destructuring. `Omit` over an
 * intersection-with-union collapses a union into a single widened shape
 * (e.g. `{ isWrongNetwork?: boolean }`), which silently defeats the whole
 * point of the discriminated unions below.
 */
export type TransactionReviewModalContentProps = TransactionReviewModalBaseProps &
  TransactionReviewNetworkState &
  TransactionReviewSigningState;

export type TransactionReviewModalProps = { readonly isOpen: boolean } & TransactionReviewModalContentProps;

/**
 * `TransactionReviewModal` itself stays mounted across openings (the caller
 * only flips `isOpen`), so any state declared directly in it — the
 * acknowledgement checkbox included — would leak from one transaction review
 * into the next (parent readback finding #1, 2026-09-27). `Modal.Backdrop`
 * already unmounts its children while closed (verified: `role="dialog"` is
 * absent from the document when `isOpen` is false), so pushing that state
 * into this inner component, mounted only inside the backdrop, resets it on
 * every reopening for free — no extra key or effect needed.
 */
function TransactionReviewModalContent({
  onClose,
  onSign,
  title,
  amount,
  assetCode,
  descriptionRows,
  acknowledgementLabel,
  ...unionState
}: TransactionReviewModalContentProps) {
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const isWrongNetwork = unionState.isWrongNetwork ?? false;
  // A blank/whitespace-only caller message would otherwise render a visually
  // empty (but still `role="alert"`-present) element — native review advisory
  // R3-empty-wrong-network-message (2026-09-27), parent readback found the
  // earlier "at least the alert exists" fix vacuous. The owner authorized one
  // canonical fallback (`microcopy.wrongNetwork`, `demo-ui.md:1173`) for this
  // exact condition; no equivalent fallback was authorized for a rejected
  // signing status (see `rejectedMessage` below).
  const wrongNetworkMessage = unionState.isWrongNetwork
    ? // `?? ""` covers untyped callers (Storybook controls, plain JS) that omit the message.
      (unionState.wrongNetworkMessage ?? "").trim() === ""
      ? microcopy.wrongNetwork
      : unionState.wrongNetworkMessage
    : undefined;
  const requiresAcknowledgement = Boolean(acknowledgementLabel);
  const isSigning = unionState.signingStatus === "signing";
  const isRejectedStatus =
    unionState.signingStatus === "signature-rejected" || unionState.signingStatus === "verification-rejected";
  const rejectedMessage = isRejectedStatus ? unionState.signingErrorMessage : undefined;
  const isSignDisabled = isWrongNetwork || (requiresAcknowledgement && !isAcknowledged);

  return (
    <Modal.Dialog className="flex flex-col gap-4">
      <Modal.CloseTrigger aria-label="Cerrar" />
      <Modal.Header className="flex flex-col gap-1 pr-8">
        <span className="text-sm font-medium text-brand-accent">Revisión antes de firmar</span>
        <Modal.Heading>{title}</Modal.Heading>
      </Modal.Header>

      <Modal.Body className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-2xl font-semibold text-foreground">
            {amount} <span>{assetCode}</span>
          </p>
          <span className="text-sm text-muted">{microcopy.testAssetNoValue}</span>
        </div>

        {descriptionRows.length > 0 ? (
          <dl className="flex flex-col gap-3">
            {descriptionRows.map((row, index) => (
              <div key={`${row.label}-${index}`} className="flex flex-col gap-1">
                <dt className="text-sm font-medium text-foreground">{row.label}</dt>
                <dd className="text-sm text-muted">
                  {row.mono ? <MonoValue label={row.label} value={row.value} /> : row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Red</span>
          <Badge variant="testnet" label={disclosures.testnet.title} tone="info" lang="es" />
        </div>
        {isWrongNetwork ? (
          <p role="alert" className="text-sm text-trust-critical">
            {wrongNetworkMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-sm text-muted">{microcopy.preSignCheck}</p>
          <CanonicalDisclosure id="non-custody" lang="es" />
        </div>

        {acknowledgementLabel ? (
          <Checkbox isSelected={isAcknowledged} onChange={setIsAcknowledged}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              {acknowledgementLabel}
            </Checkbox.Content>
          </Checkbox>
        ) : null}

        {isRejectedStatus ? (
          <p role="alert" className="text-sm text-trust-critical">
            {rejectedMessage}
          </p>
        ) : null}
      </Modal.Body>

      <Modal.Footer className="flex justify-end gap-2">
        <Button variant="secondary" onPress={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          isDisabled={isSignDisabled}
          isLoading={isSigning}
          loadingLabel="Firmando en Freighter…"
          onPress={onSign}
        >
          Firmar en Freighter
        </Button>
      </Modal.Footer>
    </Modal.Dialog>
  );
}

interface MonoValueProps {
  readonly label: string;
  readonly value: string;
}

type CopyState = "idle" | "copied" | "failed";

/**
 * The `<dd>` content for a mono description row: middle-truncated (reusing
 * `HashDisplay`'s own truncation rule so the visual behavior stays
 * identical), the full value kept for assistive tech, and copyable — without
 * `HashDisplay`'s label or TESTNET badge, which would be redundant inside a
 * `<dl>` that already has its own `<dt>` and the modal's single network
 * badge (parent readback finding #2, 2026-09-27). `HashDisplay` itself is
 * unchanged for its other callers.
 */
function MonoValue({ label, value }: MonoValueProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const truncated = truncateMiddle(value);
  const isTruncated = truncated !== value;

  const handleCopy = () => {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clipboard?.writeText) {
      setCopyState("failed");
      return;
    }
    clipboard
      .writeText(value)
      .then(() => setCopyState("copied"))
      .catch(() => setCopyState("failed"));
  };

  return (
    <span className="flex flex-wrap items-center gap-2">
      <span title={value} className="font-mono text-sm break-all">
        <span aria-hidden={isTruncated ? "true" : undefined}>{truncated}</span>
        {isTruncated ? <span className="sr-only">{value}</span> : null}
      </span>
      <Button variant="secondary" onPress={handleCopy}>
        {`Copiar ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
      </Button>
      <span aria-live="polite" className="text-sm">
        {copyState === "copied" ? "Copiado" : null}
      </span>
      {copyState === "failed" ? (
        <span role="alert" className="text-sm text-trust-critical">
          No se pudo copiar el valor. Copiálo manualmente.
        </span>
      ) : null}
    </span>
  );
}

export function TransactionReviewModal({ isOpen, onClose, ...rest }: TransactionReviewModalProps) {
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Modal.Container size="md">
        <TransactionReviewModalContent onClose={onClose} {...rest} />
      </Modal.Container>
    </Modal.Backdrop>
  );
}
