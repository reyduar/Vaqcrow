import { HttpClientError } from "@/application/ports/http-client-port";
import { WalletError } from "@/application/ports/wallet-port";

/**
 * Why a funding-intent step failed, as a coarse kind the UI can act on.
 *
 * Gateway failures and wallet failures share one union on purpose: both reach
 * the person through the same submit control, and a declined signature or a
 * wallet pointed at another network is as actionable as an HTTP refusal.
 */
export type FundingSubmitErrorKind =
  | "validation"
  | "account_not_found"
  | "not_found"
  | "xdr_rejected"
  | "idempotency_conflict"
  | "conflict"
  | "unavailable"
  | "network"
  | "not_connected"
  | "wallet_rejected"
  | "wallet_unavailable"
  | "wallet_network_mismatch"
  | "wallet_unknown"
  | "unknown";

/**
 * Sanitized failure; `message` is authored here and never contains backend or
 * wallet text. `recoverable` means the prepared intent survives: the person can
 * retry without preparing a new one.
 */
export interface FundingSubmitError {
  readonly kind: FundingSubmitErrorKind;
  readonly message: string;
  readonly recoverable: boolean;
}

const MESSAGES: Readonly<Record<FundingSubmitErrorKind, string>> = {
  validation: "El servicio rechazó los datos del envío. Revisá el destino, el monto y el memo, y volvé a preparar el envío.",
  account_not_found:
    "La cuenta de origen no está fondeada en Testnet, así que no se pudo preparar la transacción. Fondeala en Testnet y volvé a intentar.",
  not_found: "No se encontró el envío en el servicio. Volvé a preparar el envío.",
  xdr_rejected:
    "El servicio rechazó la transacción firmada. No se envió nada; volvé a firmar con la información que te mostró el servicio.",
  idempotency_conflict:
    "Ese envío ya se usó con otros datos. No se registró nada; volvé a preparar el envío para crear uno nuevo.",
  conflict: "El servicio informó un conflicto y no registró el envío. Volvé a preparar el envío.",
  unavailable: "El servicio no está disponible en este momento. No se registró nada; podés reintentar.",
  network:
    "No se pudo confirmar el resultado: no hay conexión con el servicio. Reintentar es seguro: si el envío ya se registró, se muestra el registro existente sin duplicarlo.",
  not_connected: "Conectá tu wallet para poder firmar el envío.",
  wallet_rejected:
    "Rechazaste la firma en la wallet. No se envió nada y el envío preparado sigue disponible para que vuelvas a firmar.",
  wallet_unavailable:
    "No se detectó una wallet disponible en este navegador. Instalá o habilitá Freighter y volvé a intentar.",
  wallet_network_mismatch:
    "Tu wallet está en otra red. Cambiala a la red que declara la transacción y volvé a firmar.",
  wallet_unknown: "La wallet no pudo firmar por un error inesperado. No se envió nada; podés reintentar.",
  unknown: "No se pudo completar el envío por un error inesperado. No se confirmó nada; podés reintentar."
};

/**
 * Whether the prepared intent survives this failure. Preparing is a server
 * computation with no side effect, but it costs a round trip and a wallet
 * prompt to sign again, so only the failures that invalidate the prepared
 * intent force a fresh one.
 */
const RECOVERABLE: Readonly<Record<FundingSubmitErrorKind, boolean>> = {
  validation: false,
  account_not_found: false,
  not_found: false,
  xdr_rejected: true,
  idempotency_conflict: false,
  conflict: false,
  unavailable: true,
  network: true,
  not_connected: true,
  wallet_rejected: true,
  wallet_unavailable: true,
  wallet_network_mismatch: true,
  wallet_unknown: true,
  unknown: true
};

export function fundingErrorOfKind(kind: FundingSubmitErrorKind): FundingSubmitError {
  return { kind, message: MESSAGES[kind], recoverable: RECOVERABLE[kind] };
}

const WALLET_KIND: Readonly<Record<WalletError["kind"], FundingSubmitErrorKind>> = {
  rejected: "wallet_rejected",
  unavailable: "wallet_unavailable",
  network_mismatch: "wallet_network_mismatch",
  unknown: "wallet_unknown"
};

export function toFundingSubmitError(error: unknown): FundingSubmitError {
  if (error instanceof WalletError) {
    return fundingErrorOfKind(WALLET_KIND[error.kind]);
  }

  if (!(error instanceof HttpClientError)) return fundingErrorOfKind("unknown");
  if (error.kind === "network") return fundingErrorOfKind("network");

  switch (error.status) {
    case 400:
      return fundingErrorOfKind("validation");
    case 404:
      return fundingErrorOfKind(error.errorCode === "account_not_found" ? "account_not_found" : "not_found");
    case 409:
      return fundingErrorOfKind(error.errorCode === "idempotency_conflict" ? "idempotency_conflict" : "conflict");
    case 422:
      return fundingErrorOfKind("xdr_rejected");
    case 503:
      return fundingErrorOfKind("unavailable");
    default:
      return fundingErrorOfKind("unknown");
  }
}
