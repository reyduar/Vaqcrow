"use client";

import { useState } from "react";
import { formatMonthYear } from "@/application/company/format";
import {
  buildDeclaredPeriods,
  declarationRowsFromSales,
  declareMonthsFor,
  sampleDeclaration,
  type SalesAmountRow,
  type SalesDeclarationBuildFailure
} from "@/application/company/sales-declaration";
import type { BusinessPort } from "@/application/ports/business-port";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import type { SalesDeclarationPort } from "@/application/ports/sales-declaration-port";
import { useDeclareSales, type DeclareSalesErrorCode } from "@/state/use-declare-sales";
import { Badge } from "../badge";
import { Button } from "../button";
import { TextField } from "../text-field";

/**
 * «Declarar ventas» (Feature #434, WU3): the monthly declaration entry of the
 * PyME dashboard. One amount row per month, an empty row meaning «Sin dato»
 * (a missing month, never a 0), and a «Completar con datos de ejemplo» helper
 * that fills simulated values for the demo. The submit resolves the PyME's
 * business (`GET /businesses/mine`) and POSTs the declared periods; on success
 * it shows «Enviada» and asks the dashboard to reload.
 *
 * Copy is owner-pending: the template does not design this form yet.
 */
const DECLARE_SALES_COPY = Object.freeze({
  heading: "Declarar ventas mensuales",
  intro: "Cargá las ventas de cada mes. Dejá un mes vacío si no tenés el dato: se declara como «Sin dato».",
  amountHelper: "Monto entero en pesos. Vacío = Sin dato.",
  amountUnit: "ARS",
  sinDato: "Sin dato",
  fillSample: "Completar con datos de ejemplo",
  sampleNote: "Los valores de ejemplo son simulados y sólo sirven para la demo.",
  submit: "Enviar declaración",
  sending: "Enviando…",
  sent: "Enviada",
  sentNote: "Tu declaración se guardó. Actualizamos el tablero con lo declarado.",
  close: "Cerrar",
  cancel: "Cancelar",
  errorEmpty: "Cargá al menos un mes.",
  errorPeriod: "Hay un mes con un período inválido.",
  errorAmount: "Ingresá los montos en números enteros, sin puntos ni comas.",
  errorUnavailable: "No pudimos enviar la declaración. El servicio no respondió.",
  errorNoBusiness: "No pudimos identificar tu PyME. Volvé a intentarlo.",
  errorInvalid: "La declaración fue rechazada. Revisá los montos e intentá de nuevo.",
  errorNotFound: "No encontramos tu campaña. Recargá el tablero."
});

const BUILD_FAILURE_COPY: Readonly<Record<SalesDeclarationBuildFailure, string>> = {
  empty: DECLARE_SALES_COPY.errorEmpty,
  invalid_period: DECLARE_SALES_COPY.errorPeriod,
  invalid_amount: DECLARE_SALES_COPY.errorAmount
};

const ERROR_COPY: Readonly<Record<DeclareSalesErrorCode, string>> = {
  no_business: DECLARE_SALES_COPY.errorNoBusiness,
  unavailable: DECLARE_SALES_COPY.errorUnavailable,
  network: DECLARE_SALES_COPY.errorUnavailable,
  unauthenticated: DECLARE_SALES_COPY.errorInvalid,
  invalid_request: DECLARE_SALES_COPY.errorInvalid,
  not_found: DECLARE_SALES_COPY.errorNotFound
};

export interface CompanyDeclareSalesProps {
  readonly campaign: MyCampaign;
  /** Declaration gateway; `null` fails closed to the unavailable message. */
  readonly port: SalesDeclarationPort | null;
  /** Resolves the signed-in PyME's business; `null` fails closed. */
  readonly business: BusinessPort | null;
  /** Called once after a successful declaration so the dashboard reloads. */
  readonly onSubmitted: () => void;
  readonly onCancel: () => void;
}

export function CompanyDeclareSales({
  campaign,
  port,
  business,
  onSubmitted,
  onCancel
}: CompanyDeclareSalesProps) {
  const months = declareMonthsFor(campaign.sales, campaign.deadline);
  const [rows, setRows] = useState<readonly SalesAmountRow[]>(() => {
    const fromSales = declarationRowsFromSales(campaign.sales);
    return fromSales.length > 0 ? fromSales : months.map((period) => ({ period, amount: "" }));
  });
  const [formError, setFormError] = useState<string | null>(null);
  const declare = useDeclareSales(port, business, onSubmitted);

  function updateRow(period: string, amount: string): void {
    setRows((current) => current.map((row) => (row.period === period ? { ...row, amount } : row)));
  }

  function fillSample(): void {
    setFormError(null);
    setRows(sampleDeclaration(months));
  }

  async function submit(): Promise<void> {
    setFormError(null);
    const built = buildDeclaredPeriods(rows);
    if (!built.ok) {
      setFormError(BUILD_FAILURE_COPY[built.reason]);
      return;
    }
    await declare.submit(built.periods);
  }

  const submitted = declare.status === "submitted";
  const errorMessage = formError ?? (declare.errorCode === null ? null : ERROR_COPY[declare.errorCode]);

  return (
    <section
      aria-label={`Declarar ventas de ${campaign.name}`}
      className="flex flex-col gap-5 rounded-card border border-border p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[22px] leading-[1.2] font-bold tracking-[-0.02em]">
            {DECLARE_SALES_COPY.heading}
          </h2>
          <p className="m-0 text-sm text-text-secondary">{DECLARE_SALES_COPY.intro}</p>
        </div>
        <Badge variant="simulado" label="SIMULADO" lang="es" />
      </div>

      {submitted ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-trust-success-surface px-4 py-3.5 text-trust-success"
        >
          <span className="flex flex-1 items-center gap-2 text-sm text-trust-success">
            <strong className="font-[650]">{DECLARE_SALES_COPY.sent}</strong>
            {DECLARE_SALES_COPY.sentNote}
          </span>
          <Button variant="ghost" onPress={onCancel}>
            {DECLARE_SALES_COPY.close}
          </Button>
        </div>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {rows.map((row) => (
              <li key={row.period} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <TextField
                    label={`Ventas de ${formatMonthYear(row.period)}`}
                    inputMode="numeric"
                    value={row.amount}
                    onChange={(value) => updateRow(row.period, value)}
                    unit={DECLARE_SALES_COPY.amountUnit}
                    helperText={DECLARE_SALES_COPY.amountHelper}
                    fullWidth
                  />
                </div>
                {row.amount.trim() === "" ? (
                  <span className="pb-7 text-xs font-semibold text-text-secondary">
                    {DECLARE_SALES_COPY.sinDato}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onPress={fillSample}>
              {DECLARE_SALES_COPY.fillSample}
            </Button>
            <span className="text-xs text-text-secondary">{DECLARE_SALES_COPY.sampleNote}</span>
          </div>

          {errorMessage ? (
            <p role="alert" className="m-0 text-sm font-semibold text-trust-critical">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              onPress={() => void submit()}
              isLoading={declare.status === "submitting"}
              loadingLabel={DECLARE_SALES_COPY.sending}
            >
              {DECLARE_SALES_COPY.submit}
            </Button>
            <Button variant="ghost" onPress={onCancel}>
              {DECLARE_SALES_COPY.cancel}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
