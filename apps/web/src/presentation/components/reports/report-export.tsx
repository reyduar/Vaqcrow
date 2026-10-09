"use client";

import { IoDownloadOutline } from "react-icons/io5";
import { Button } from "../button";

/**
 * The "Exportar" control of `Vaqcrow Informes.dc.html` (Feature #430, WU2).
 * Presentational only: WU3 wires the CSV + print-to-PDF mechanism through
 * `onExport`; until then the container passes nothing and the control renders
 * disabled with a visible reason (never a tooltip-only affordance).
 *
 * Owner-pending copy: the disabled reason ("La exportación todavía no está
 * disponible.") — the template's own helper text ("...no está disponible en
 * esta demo") is superseded by owner decision D2, which makes export
 * functional, so this is a transitional string to be replaced by the WU3 copy.
 */
export type ReportExportStatus = "idle" | "loading" | "ready" | "unavailable";

export interface ReportExportProps {
  /** WU3 mechanism; when omitted the control stays disabled. */
  readonly onExport?: () => void;
  readonly status?: ReportExportStatus;
}

const DISABLED_REASON = "La exportación todavía no está disponible.";

export function ReportExport({ onExport, status }: ReportExportProps) {
  const resolved: ReportExportStatus = status ?? (onExport ? "ready" : "unavailable");
  const isUnavailable = resolved === "unavailable";

  return (
    <Button
      variant="secondary"
      isDisabled={isUnavailable}
      isLoading={resolved === "loading"}
      loadingLabel="Exportando…"
      {...(isUnavailable ? { disabledReason: DISABLED_REASON } : {})}
      {...(onExport && !isUnavailable ? { onPress: onExport } : {})}
    >
      <IoDownloadOutline aria-hidden="true" focusable="false" className="mr-1.5 inline h-[17px] w-[17px]" />
      Exportar
    </Button>
  );
}
