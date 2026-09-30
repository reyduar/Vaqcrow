import type { DerivationFailureReason } from "@/application/ports/revenue-share-distribution-gateway";

/**
 * One truthful sentence per reason the API gives for refusing a derivation.
 * Authored here and never sourced from the backend: the API returns only the
 * closed reason token, and each sentence says what is actually true and what
 * the person can do about it.
 */
const COPY: Readonly<Record<DerivationFailureReason, string>> = {
  campaign_not_found:
    "No se encontró la campaña de esta distribución. Retome el recorrido desde el paso de fondeo.",
  application_not_found:
    "No se encontró la solicitud de esta campaña. Retome el recorrido desde la solicitud.",
  application_mismatch:
    "La campaña no corresponde a la solicitud de este recorrido. Retome el recorrido desde la solicitud.",
  source_not_sme:
    "Conecte en Freighter la cuenta de la PyME de esta campaña: solo esa cuenta puede firmar la distribución.",
  campaign_not_settled:
    "La campaña todavía no se liquidó en la cadena, y solo se distribuye sobre una campaña liquidada. Complete el fondeo y la liquidación primero.",
  decision_not_approved:
    "La solicitud no tiene una decisión humana de aprobación registrada, así que no hay un límite aprobado sobre el que calcular la distribución.",
  no_eligible_period:
    "El historial de ventas simulado de la PyME no tiene un período informado que se pueda usar para calcular la obligación.",
  invalid_sales_data:
    "Los datos de ventas simulados de la PyME no son válidos, así que no se pudo calcular la obligación.",
  no_contributors: "La campaña no registra aportantes a quienes distribuir.",
  contributions_incomplete:
    "Los aportes confirmados que conoce el servicio no suman el total de la campaña, así que no se distribuye para no dejar a nadie sin cobrar. Consulte el aporte de cada inversor desde el paso de fondeo con su cuenta conectada.",
  obligation_rounds_to_zero:
    "La obligación calculada es menor que la unidad mínima, así que no hay nada que distribuir."
};

export function derivationFailureMessage(reason: DerivationFailureReason): string {
  return COPY[reason];
}
