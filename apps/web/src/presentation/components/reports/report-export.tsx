"use client";

import { IoDownloadOutline, IoPrintOutline } from "react-icons/io5";
import { Button } from "../button";

/**
 * The "Exportar" control of `Vaqcrow Informes.dc.html` (Feature #430, WU3).
 * Owner decision D2 makes the export functional — a CSV download and the
 * browser's print-to-PDF — with no new dependency, superseding the template's
 * disabled "no disponible en esta demo" treatment.
 *
 * Presentational: the two mechanisms arrive as props, so tests never touch the
 * DOM download/print APIs and the container owns the current report. Both
 * actions are real buttons inside a named group, and both disable while the
 * report is still loading (never a silent no-op).
 *
 * Owner-pending copy: the button labels ("Descargar CSV", "Imprimir / PDF")
 * and the group label ("Exportar"). The template only designs a single
 * disabled "Exportar" button, so D2's two concrete actions are new copy.
 */
export interface ReportExportProps {
  readonly onDownloadCsv: () => void;
  readonly onPrint: () => void;
  /** Disables both actions while the report is still loading. */
  readonly isLoading?: boolean;
}

export function ReportExport({ onDownloadCsv, onPrint, isLoading = false }: ReportExportProps) {
  return (
    <div role="group" aria-label="Exportar" className="no-print flex flex-wrap items-end gap-2">
      <Button
        variant="secondary"
        onPress={onDownloadCsv}
        isLoading={isLoading}
        loadingLabel="Preparando…"
      >
        <IoDownloadOutline aria-hidden="true" focusable="false" className="mr-1.5 inline h-[17px] w-[17px]" />
        Descargar CSV
      </Button>
      <Button variant="secondary" onPress={onPrint} isDisabled={isLoading}>
        <IoPrintOutline aria-hidden="true" focusable="false" className="mr-1.5 inline h-[17px] w-[17px]" />
        Imprimir / PDF
      </Button>
    </div>
  );
}
