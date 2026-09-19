import { HttpClientError } from "@/application/ports/http-client-port";

export type DecisionSubmitErrorKind =
  | "validation"
  | "state_conflict"
  | "idempotency_conflict"
  | "conflict"
  | "not_found"
  | "unavailable"
  | "network"
  | "unknown";

/** Sanitized failure; `message` is authored here and never contains backend text. */
export interface DecisionSubmitError {
  readonly kind: DecisionSubmitErrorKind;
  readonly message: string;
}

const MESSAGES: Readonly<Record<DecisionSubmitErrorKind, string>> = {
  validation: "El servicio rechazó los datos de la decisión. Revisalos e intentá de nuevo. No se registró nada.",
  state_conflict:
    "Esta solicitud ya no está pendiente de revisión humana, por lo que no se registró tu decisión. Recargá para ver el estado actual.",
  idempotency_conflict:
    "Ese identificador de decisión ya se usó con otros datos. No se registró nada; volvé a enviar para crear un intento nuevo.",
  conflict: "El servicio informó un conflicto y no registró la decisión.",
  not_found: "No se encontró la solicitud en el servicio. No se registró nada.",
  unavailable: "El servicio no está disponible en este momento. No se registró nada confirmado; podés reintentar.",
  network:
    "No se pudo confirmar el resultado: no hay conexión con el servicio. Reintentar es seguro: si la decisión ya se guardó, se muestra el registro existente sin duplicarla.",
  unknown: "No se pudo registrar la decisión por un error inesperado. No se confirmó nada; podés reintentar."
};

export function decisionErrorOfKind(kind: DecisionSubmitErrorKind): DecisionSubmitError {
  return { kind, message: MESSAGES[kind] };
}

export function toDecisionSubmitError(error: unknown): DecisionSubmitError {
  if (!(error instanceof HttpClientError)) return decisionErrorOfKind("unknown");
  if (error.kind === "network") return decisionErrorOfKind("network");

  switch (error.status) {
    case 400:
      return decisionErrorOfKind("validation");
    case 404:
      return decisionErrorOfKind("not_found");
    case 409:
      if (error.errorCode === "state_conflict") return decisionErrorOfKind("state_conflict");
      if (error.errorCode === "idempotency_conflict") return decisionErrorOfKind("idempotency_conflict");
      return decisionErrorOfKind("conflict");
    case 503:
      return decisionErrorOfKind("unavailable");
    default:
      return decisionErrorOfKind("unknown");
  }
}
