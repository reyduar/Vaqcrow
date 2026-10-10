"use client";

import { useState } from "react";
import { microcopy } from "@/application/trust/disclosures";
import { Badge } from "./badge";
import { Button } from "./button";

/**
 * HashDisplay (Issue #310 / T2): shows a Testnet transaction hash or
 * contract id middle-truncated for reading, while keeping the full value
 * available to assistive tech (`title` plus a visually-hidden `sr-only`
 * span) and copyable via `navigator.clipboard`. Presentational only — the
 * caller supplies the already-known value and, optionally, an explorer URL;
 * this component never talks to the network or derives a link itself,
 * mirroring `campaign-workspace.tsx`/`funding-workspace.tsx`'s existing "the
 * API supplies the link" rule.
 *
 * The TESTNET context is the canonical `microcopy.testnetBadge` rendered
 * through the shared `Badge`, the same pair every other Testnet-context
 * screen already uses — no new wording.
 *
 * Truncation mirrors the template's own hash treatment (`Vaqcrow
 * Sistema.dc.html`: `fullHash.slice(0, 10) + '…' + fullHash.slice(-8)`); a
 * value too short to benefit from it renders in full instead.
 */
export interface HashDisplayProps {
  /** e.g. "Hash de transacción" or "Contrato". */
  readonly label: string;
  readonly value: string;
  /** Caller-supplied Testnet explorer URL; omit to render no link. */
  readonly explorerUrl?: string;
  /**
   * What the explorer link proves, for its accessible name (#438/WU5), e.g.
   * «Contrato de la bóveda» vs «Transacción de despliegue». Defaults to
   * `label`, so two links in one section stay distinguishable to assistive tech.
   * The name starts with the visible «Ver en el explorador» (WCAG 2.5.3, label
   * in name).
   */
  readonly proofLabel?: string;
  readonly className?: string;
}

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

function lowerFirst(text: string): string {
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

const HEAD_CHARS = 10;
const TAIL_CHARS = 8;

/**
 * Middle-truncation shared with other components that need the same visual
 * rule without the rest of `HashDisplay`'s chrome (label, TESTNET badge,
 * explorer link) — e.g. `TransactionReviewModal`'s own `<dd>` values. Kept
 * here as the single source of the truncation rule; `HashDisplay`'s public
 * behavior for its existing callers is unchanged.
 */
export function truncateMiddle(value: string): string {
  if (value.length <= HEAD_CHARS + TAIL_CHARS + 1) {
    return value;
  }
  return `${value.slice(0, HEAD_CHARS)}…${value.slice(-TAIL_CHARS)}`;
}

type CopyState = "idle" | "copied" | "failed";

export function HashDisplay({ label, value, explorerUrl, proofLabel, className }: HashDisplayProps) {
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
    <div className={`flex flex-col gap-2 ${className ?? ""}`.trim()}>
      <span className="text-sm font-medium">{label}</span>
      {/* Hash + copy surface from `Vaqcrow Sistema.dc.html` line 210: a
          bordered `--surface` box at the control radius, Geist Mono value. */}
      <div className="flex flex-wrap items-center gap-2 rounded-control border border-border bg-page-surface px-3.5 py-2">
        <span title={value} className="min-w-0 flex-1 font-mono text-[13px] break-all">
          <span aria-hidden={isTruncated ? "true" : undefined}>{truncated}</span>
          {isTruncated ? <span className="sr-only">{value}</span> : null}
        </span>
        <Button variant="secondary" onPress={handleCopy}>
          {`Copiar ${lowerFirst(label)}`}
        </Button>
      </div>
      <span aria-live="polite" className="text-sm">
        {copyState === "copied" ? "Copiado" : null}
      </span>
      {copyState === "failed" ? (
        <span role="alert" className="text-sm text-trust-critical">
          No se pudo copiar el valor. Copiálo manualmente.
        </span>
      ) : null}
      <Badge variant="testnet" label={microcopy.testnetBadge} lang="es" />
      {explorerUrl ? (
        <a
          className={`self-start rounded text-sm underline ${FOCUS_RING}`}
          href={explorerUrl}
          rel="noreferrer noopener"
          target="_blank"
          aria-label={`Ver en el explorador: ${lowerFirst(proofLabel ?? label)} (abre en una pestaña nueva)`}
        >
          Ver en el explorador
        </a>
      ) : null}
    </div>
  );
}
