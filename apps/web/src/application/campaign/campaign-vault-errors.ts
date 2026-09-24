import { HttpClientError } from "@/application/ports/http-client-port";
import { WalletError } from "@/application/ports/wallet-port";

/**
 * Why a campaign-vault step failed, as a coarse kind the UI can act on.
 *
 * Gateway failures and wallet failures share one union, the same way
 * `FundingSubmitErrorKind` does: both reach the person through the same
 * contribute/withdraw/refund controls. `not_funding` is its own kind (not
 * folded into `refused`) because the workspace reacts to it by hiding the
 * contribute control, not just showing an error; `refused` covers every
 * other 409/422 the backend can answer (`application_not_approved`,
 * `sme_account_unavailable`, `vault_state_mismatch`, a signature the chain
 * rejected, or a submitted transaction that settled `failed`).
 */
export type CampaignVaultErrorKind =
  | "validation"
  | "not_found"
  | "not_funding"
  | "refused"
  | "unavailable"
  | "network"
  | "not_connected"
  | "wallet_rejected"
  | "wallet_unavailable"
  | "wallet_network_mismatch"
  | "wallet_unknown"
  | "unknown";

/** Sanitized failure; `message` is authored here and never contains backend or wallet text. */
export interface CampaignVaultError {
  readonly kind: CampaignVaultErrorKind;
  readonly message: string;
}

const MESSAGES: Readonly<Record<CampaignVaultErrorKind, string>> = {
  validation: "El servicio rechazó los datos de la operación. Revisá los valores y volvé a intentar.",
  not_found: "No se encontró la campaña en el servicio.",
  not_funding:
    "La bóveda ya no acepta aportes: la cadena confirma que salió del estado de fondeo. Actualizá la vista.",
  refused:
    "El servicio rechazó la operación. No se registró nada; revisá el estado de la campaña y volvé a intentar.",
  unavailable: "El servicio no está disponible en este momento. No se registró nada; podés reintentar.",
  network: "No se pudo confirmar el resultado: no hay conexión con el servicio.",
  not_connected: "Conectá tu wallet para poder firmar esta operación.",
  wallet_rejected: "Rechazaste la firma en la wallet. No se envió nada; podés volver a firmar.",
  wallet_unavailable: "No se detectó una wallet disponible en este navegador. Instalá o habilitá Freighter.",
  wallet_network_mismatch: "Tu wallet está en otra red. Cambiala a la red que declara la transacción y volvé a firmar.",
  wallet_unknown: "La wallet no pudo firmar por un error inesperado. Podés reintentar.",
  unknown: "No se pudo completar la operación por un error inesperado. No se confirmó nada; podés reintentar."
};

export function campaignVaultErrorOfKind(kind: CampaignVaultErrorKind): CampaignVaultError {
  return { kind, message: MESSAGES[kind] };
}

const WALLET_KIND: Readonly<Record<WalletError["kind"], CampaignVaultErrorKind>> = {
  rejected: "wallet_rejected",
  unavailable: "wallet_unavailable",
  network_mismatch: "wallet_network_mismatch",
  unknown: "wallet_unknown"
};

export function toCampaignVaultError(error: unknown): CampaignVaultError {
  if (error instanceof WalletError) {
    return campaignVaultErrorOfKind(WALLET_KIND[error.kind]);
  }

  if (!(error instanceof HttpClientError)) return campaignVaultErrorOfKind("unknown");
  if (error.kind === "network") return campaignVaultErrorOfKind("network");

  switch (error.status) {
    case 400:
      return campaignVaultErrorOfKind("validation");
    case 404:
      return campaignVaultErrorOfKind("not_found");
    case 409:
      return campaignVaultErrorOfKind(error.errorCode === "campaign_not_funding" ? "not_funding" : "refused");
    case 422:
      return campaignVaultErrorOfKind("refused");
    case 503:
      return campaignVaultErrorOfKind("unavailable");
    default:
      return campaignVaultErrorOfKind("unknown");
  }
}
