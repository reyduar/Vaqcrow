"use client";

import type { IconType } from "react-icons";
import {
  IoBarChartOutline,
  IoBusinessOutline,
  IoCheckmarkOutline,
  IoCloseOutline,
  IoDocumentTextOutline,
  IoImageOutline,
  IoMailOutline,
  IoOpenOutline
} from "react-icons/io5";
import {
  KYC_COPY,
  KYC_VERDICT_OPTIONS,
  type KycOptionIcon,
  type KycOptionTone,
  type KycRowIcon
} from "@/application/admin/kyc";
import type { AdminReviewContext, AdminReviewPort } from "@/application/ports/admin-review-port";
import type { OpenDocumentWindow } from "@/application/ports/document-window-port";
import { useKycReview } from "@/state/use-kyc-review";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const ROW_ICONS: Readonly<Record<KycRowIcon, IconType>> = {
  business: IoBusinessOutline,
  document: IoDocumentTextOutline,
  chart: IoBarChartOutline,
  image: IoImageOutline
};

const OPTION_ICONS: Readonly<Record<KycOptionIcon, IconType>> = {
  check: IoCheckmarkOutline,
  mail: IoMailOutline,
  close: IoCloseOutline
};

/** Pressed treatment from the template's `opts`: tone surface + tone text, no border. */
const PRESSED_TONE: Readonly<Record<KycOptionTone, string>> = {
  success: "border-transparent bg-trust-success-surface text-trust-success",
  caution: "border-transparent bg-trust-caution-surface text-trust-caution",
  critical: "border-transparent bg-trust-critical-surface text-trust-critical"
};

const UNPRESSED = "border-control bg-transparent text-text-primary";

export interface KycSectionProps {
  readonly context: AdminReviewContext;
  readonly reload: () => void;
  readonly port: AdminReviewPort;
  readonly openWindow: OpenDocumentWindow;
}

/**
 * Section «1 · KYC/KYB» of the admin review (`Vaqcrow Admin.dc.html`, view
 * `review`; #410 / U3): one row per uploaded document with the persisted
 * «Válido / Pedir / Inválido» verdict as `aria-pressed` toggles, and an
 * «Abrir» control that reads the private file through the authenticated
 * download (D1). Buttons are 44px tall (template: 36px) for the minimum touch
 * target of `demo-ui.md` §5.6.
 */
export function KycSection({ context, reload, port, openWindow }: KycSectionProps) {
  const { rows, editable, saving, openingDocumentId, message, setVerdict, openDocument } = useKycReview(
    port,
    context,
    reload,
    openWindow
  );
  const togglesDisabled = !editable || saving;

  return (
    <section
      aria-labelledby="kyc-title"
      className="flex flex-col gap-3.5 rounded-card border border-page-border p-[22px] text-text-primary"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="kyc-title" className="m-0 text-lg font-bold">
          {KYC_COPY.title}
        </h2>
        <span className="rounded-pill border border-dashed border-text-secondary px-2 py-[3px] text-[11px] font-[650] tracking-[0.04em]">
          {KYC_COPY.simulated}
        </span>
      </div>

      {rows.length === 0 ? <p className="m-0 text-sm text-text-secondary">{KYC_COPY.noDocuments}</p> : null}

      {rows.map((row) => {
        const RowIcon = ROW_ICONS[row.icon];
        const opening = openingDocumentId === row.documentId;
        return (
          <div
            key={row.documentId}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-page-surface px-3.5 py-3"
          >
            <RowIcon aria-hidden="true" focusable="false" className="text-xl text-brand-accent-text" />
            <div className="min-w-40 flex-1">
              <div className="text-[15px] font-[650]">{row.title}</div>
              <div className="text-xs break-all text-text-secondary">{row.subtitle}</div>
            </div>
            <button
              type="button"
              aria-label={`${KYC_COPY.open} ${row.title}`}
              aria-busy={opening ? "true" : undefined}
              disabled={openingDocumentId !== null}
              onClick={() => void openDocument(row)}
              className={`flex h-11 items-center gap-1 rounded-lg border border-control px-2.5 text-[13px] font-semibold text-text-primary hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              <IoOpenOutline aria-hidden="true" focusable="false" className="text-[15px]" />
              {KYC_COPY.open}
            </button>
            <div role="group" aria-label={row.groupLabel} className="flex gap-1.5">
              {KYC_VERDICT_OPTIONS.map((option) => {
                const pressed = row.verdict === option.value;
                const OptionIcon = OPTION_ICONS[option.icon];
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={pressed ? "true" : "false"}
                    disabled={togglesDisabled}
                    onClick={() => void setVerdict(row, option.value)}
                    className={`flex h-11 items-center gap-1 rounded-lg border px-2.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${pressed ? PRESSED_TONE[option.tone] : UNPRESSED} ${FOCUS_RING}`}
                  >
                    <OptionIcon aria-hidden="true" focusable="false" className="text-[15px]" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {message ? (
        <p role="alert" className="m-0 text-sm text-text-primary">
          {message}
        </p>
      ) : null}
    </section>
  );
}
