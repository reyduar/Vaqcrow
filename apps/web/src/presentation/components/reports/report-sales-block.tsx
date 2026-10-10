"use client";

import { IoAlertCircleOutline, IoCheckmarkOutline, IoCloudOfflineOutline } from "react-icons/io5";
import { toSalesRows, type ReportSalesRow, type ReportTone } from "@/application/reports/distributions";
import type { ReportSalesState } from "@/state/use-report-sales";
import { Button } from "../button";

/**
 * "Ventas declaradas por PyME" (`Vaqcrow Informes.dc.html`, Feature #430, WU2).
 * Presentational, but it owns the block's **partial-error state**: the block has
 * its own fetch, so a failure here shows `No pudimos cargar este bloque` +
 * `El resto del informe está actualizado.` + `Reintentar` while the rest of the
 * report stays up.
 *
 * Owner-pending copy: the per-row status notes. The template's notes are
 * per-PyME marketing strings ("Abril faltante · junio con anomalía") that the
 * API does not send, so neutral per-status strings are used instead.
 */
export interface ReportSalesBlockProps {
  readonly state: ReportSalesState;
  readonly onRetry: () => void;
  readonly className?: string;
}

const TONE_CLASS: Readonly<Record<ReportTone, string>> = {
  neutral: "text-text-secondary",
  success: "text-trust-success",
  caution: "text-trust-caution",
  critical: "text-trust-critical"
};

function StatusIcon({ status }: { readonly status: ReportSalesRow["status"] }) {
  const Icon = status === "reported" ? IoCheckmarkOutline : IoAlertCircleOutline;
  return <Icon aria-hidden="true" focusable="false" className="h-[14px] w-[14px]" />;
}

function SalesRow({ row }: { readonly row: ReportSalesRow }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-control bg-page-surface p-3.5">
      <div className="flex items-center gap-2.5">
        {row.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- an API-proxied bytes endpoint; next/image would need remote-pattern config.
          <img src={row.imageSrc} alt="" aria-hidden="true" className="h-9 w-9 rounded-control object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-control border border-border text-sm font-semibold text-text-secondary"
          >
            {row.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold">{row.name}</div>
          <div className="text-xs text-text-secondary">{row.sector}</div>
        </div>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">
          Ventas de {row.monthLabel} <span className="text-[10px] font-[650] tracking-[0.04em] text-text-primary">· SIMULADO</span>
        </span>
        <span className="font-[650]">{row.amount}</span>
      </div>
      <div className={`flex items-center gap-1.5 text-xs ${TONE_CLASS[row.tone]}`}>
        <StatusIcon status={row.status} />
        {row.statusLabel}
      </div>
    </li>
  );
}

export function ReportSalesBlock({ state, onRetry, className }: ReportSalesBlockProps) {
  return (
    <section
      aria-labelledby="report-sales-heading"
      className={`flex flex-col gap-3.5 rounded-card border border-border p-6 ${className ?? ""}`.trim()}
    >
      <h2 id="report-sales-heading" className="m-0 text-[19px] font-bold">
        Ventas declaradas por PyME
      </h2>

      {state.loadFailed ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2.5 rounded-control bg-trust-critical-surface p-4 text-trust-critical"
        >
          <div className="flex items-center gap-2 text-[15px] font-[650]">
            <IoCloudOfflineOutline aria-hidden="true" focusable="false" className="h-[19px] w-[19px]" />
            No pudimos cargar este bloque
          </div>
          <span className="text-sm">El resto del informe está actualizado.</span>
          <Button variant="destructive" onPress={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : state.isLoading ? (
        <p role="status" className="m-0 text-sm text-text-secondary">
          Cargando ventas declaradas…
        </p>
      ) : (state.data?.pymes.length ?? 0) === 0 ? (
        <p className="m-0 text-sm text-text-secondary">Sin ventas declaradas en el período.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {toSalesRows(state.data?.pymes ?? []).map((row) => (
            <SalesRow key={`${row.name}-${row.monthLabel}`} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
