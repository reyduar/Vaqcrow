import { HttpClientError } from "@/application/ports/http-client-port";
import type { SmeRequestFormField, SmeRequestSubmitError } from "./review-view-model";

/**
 * Backend field-error codes this UI understands, mapped to predefined
 * Spanish messages. Backend text is never rendered: an unknown field or code
 * is dropped, so only copy authored here can reach the screen.
 */
const FIELD_MESSAGES: Readonly<
  Record<SmeRequestFormField, Readonly<Record<string, string>>>
> = {
  declaredTotalArs: {
    required: "Ingresá el total declarado.",
    not_integer: "El total debe ser un número entero de pesos.",
    out_of_range: "El total declarado está fuera del rango permitido."
  },
  periodStart: {
    required: "Ingresá el período inicial.",
    invalid_format: "El período inicial no tiene el formato AAAA-MM."
  },
  periodEnd: {
    required: "Ingresá el período final.",
    invalid_format: "El período final no tiene el formato AAAA-MM.",
    before_start: "El período final no puede ser anterior al inicial."
  }
};

const GENERIC_MESSAGE = "No se pudo enviar la solicitud. Revisá los datos e intentá de nuevo.";
const NETWORK_MESSAGE = "No hay conexión con el servicio. La solicitud no se envió; intentá de nuevo.";
// Defensive mapping for the API's server-side wallet precondition (Feature #402,
// T1b): the UI already gates on a stored key, so this only fires when the server
// disagrees (e.g. the key was lost). New copy, flagged for owner approval.
const WALLET_REQUIRED_MESSAGE =
  "El servidor no tiene tu wallet Freighter registrada. Volvé a conectar Freighter y enviá la solicitud de nuevo.";

export function toSmeSubmitError(error: unknown): SmeRequestSubmitError {
  if (!(error instanceof HttpClientError)) return { message: GENERIC_MESSAGE };
  if (error.kind === "network") return { message: NETWORK_MESSAGE };
  if (error.status === 409 && error.errorCode === "wallet_required") return { message: WALLET_REQUIRED_MESSAGE };

  const fieldErrors: Partial<Record<SmeRequestFormField, string>> = {};
  for (const [field, code] of Object.entries(error.fieldErrors ?? {})) {
    if (!Object.hasOwn(FIELD_MESSAGES, field)) continue;
    const messages = FIELD_MESSAGES[field as SmeRequestFormField];
    if (!Object.hasOwn(messages, code)) continue;
    const message = messages[code];
    if (message !== undefined) fieldErrors[field as SmeRequestFormField] = message;
  }

  return Object.keys(fieldErrors).length > 0
    ? { message: GENERIC_MESSAGE, fieldErrors }
    : { message: GENERIC_MESSAGE };
}
