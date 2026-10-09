import { derivationFailureMessage } from "@/application/distribution/derivation-failure-copy";
import type {
  RevenueShareDistributionErrorKind,
  RevenueShareDistributionGatewayError
} from "@/application/ports/revenue-share-distribution-gateway";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import { WalletError } from "@/application/ports/wallet-port";

/**
 * Pure helpers of the PyME «Revisar y firmar» action (Feature #434, WU4).
 * React-free and vendor-free: the failure vocabulary, its Spanish sentences,
 * the display aggregation the review shows and the review's own rows. Nothing
 * here talks to a wallet or the network, and no backend or wallet message ever
 * reaches a sentence — the copy is authored here.
 */

/**
 * Why the dashboard's signing action failed, as a coarse kind the UI can act on.
 * Backend kinds come from the distribution gateway's sanitized union; the
 * `wallet_*` kinds are added because signing happens in the component; and
 * `identity_unavailable` is the dashboard's own — the campaign's application
 * identity could not be resolved, so no signature may be requested.
 */
export type DistributionSigningFailureKind =
  | RevenueShareDistributionErrorKind
  | "not_connected"
  | "identity_unavailable"
  | "wallet_rejected"
  | "wallet_unavailable"
  | "wallet_network_mismatch"
  | "wallet_unknown";

/** The closed set, in a stable order, so a test can prove every kind has copy. */
export const DISTRIBUTION_SIGNING_FAILURE_KINDS = [
  "derivation_failed",
  "derivation_mismatch",
  "already_distributed",
  "validation",
  "account_not_found",
  "not_found",
  "xdr_rejected",
  "idempotency_conflict",
  "conflict",
  "unavailable",
  "network",
  "unknown",
  "not_connected",
  "identity_unavailable",
  "wallet_rejected",
  "wallet_unavailable",
  "wallet_network_mismatch",
  "wallet_unknown"
] as const satisfies readonly DistributionSigningFailureKind[];

export interface DistributionSigningFailure {
  readonly kind: DistributionSigningFailureKind;
  readonly message: string;
}

/**
 * One truthful sentence per coarse kind. `derivation_failed` is absent on
 * purpose: it always carries a reason and is composed by
 * `distributionSigningFailureOfError`.
 */
const MESSAGES: Readonly<Record<Exclude<DistributionSigningFailureKind, "derivation_failed">, string>> = {
  derivation_mismatch:
    "Los términos que se iban a firmar ya no coinciden con lo que el servicio calcula para esta campaña. No se registró nada; volvé a revisar la distribución.",
  already_distributed:
    "Ya existe una distribución para este período de esta campaña. No se registró otra.",
  validation: "El servicio rechazó los datos de la distribución. Volvé a intentarlo.",
  account_not_found:
    "La cuenta de la PyME no está fondeada en Testnet, así que no se pudo preparar la distribución.",
  not_found: "No se encontró la distribución en el servicio. Recargá el tablero.",
  xdr_rejected:
    "El servicio rechazó la transacción firmada. No se envió nada; volvé a firmar con la información que el servicio te mostró.",
  idempotency_conflict:
    "Esa distribución ya se usó con otros datos. No se registró nada; recargá el tablero.",
  conflict: "El servicio informó un conflicto y no registró la distribución. Volvé a intentarlo.",
  unavailable: "El servicio no está disponible en este momento. No se registró nada; podés reintentar.",
  network:
    "No se pudo confirmar el resultado: no hay conexión con el servicio. Reintentar es seguro; si la distribución ya se registró, se muestra el registro existente sin duplicarlo.",
  unknown: "No se pudo completar la distribución por un error inesperado. No se confirmó nada; podés reintentar.",
  not_connected:
    "Conectá en Freighter la cuenta de la PyME de esta campaña para firmar la distribución.",
  identity_unavailable:
    "No pudimos identificar la solicitud de esta campaña, así que no se puede preparar la firma. Recargá el tablero.",
  wallet_rejected:
    "Rechazaste la firma en la wallet. No se envió nada y la distribución preparada sigue disponible para volver a firmar.",
  wallet_unavailable:
    "No se detectó una wallet disponible en este navegador. Instalá o habilitá Freighter y volvé a intentarlo.",
  wallet_network_mismatch:
    "Tu wallet está en otra red. Cambiala a la red que declara la transacción y volvé a firmar.",
  wallet_unknown: "La wallet no pudo firmar por un error inesperado. No se envió nada; podés reintentar."
};

export function distributionSigningFailureOfKind(
  kind: Exclude<DistributionSigningFailureKind, "derivation_failed">
): DistributionSigningFailure {
  return { kind, message: MESSAGES[kind] };
}

/** A refused derivation names its reason; every other gateway failure is a coarse kind. */
export function distributionSigningFailureOfError(
  error: RevenueShareDistributionGatewayError
): DistributionSigningFailure {
  if (error.kind === "derivation_failed") {
    return { kind: "derivation_failed", message: derivationFailureMessage(error.reason) };
  }
  return distributionSigningFailureOfKind(error.kind);
}

const WALLET_KIND: Readonly<
  Record<WalletError["kind"], Exclude<DistributionSigningFailureKind, "derivation_failed">>
> = {
  rejected: "wallet_rejected",
  unavailable: "wallet_unavailable",
  network_mismatch: "wallet_network_mismatch",
  unknown: "wallet_unknown"
};

export function toDistributionSigningFailure(caught: unknown): DistributionSigningFailure {
  if (caught instanceof WalletError) return distributionSigningFailureOfKind(WALLET_KIND[caught.kind]);
  return distributionSigningFailureOfKind("unknown");
}

/**
 * Sums the amounts the **service returned** so the review can show the total.
 * This is display aggregation of the API's own numbers, not the obligation
 * calculation: the API built the envelope and remains its only authority.
 */
export function totalRecipientStroops(recipients: readonly { readonly amountStroops: bigint }[]): bigint {
  return recipients.reduce((sum, recipient) => sum + recipient.amountStroops, 0n);
}

/** One row of the review's description list. Structurally the modal's own row shape. */
export interface DistributionReviewRow {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}

/** Owner-pending copy: the template designs no review screen for a distribution. */
const DISTRIBUTION_FUNCTION_LABEL = "Distribución de ingresos de la campaña";
const CUSTODY_LABEL =
  "Firma no custodial: Freighter firma la transacción y Vaqcrow nunca recibe tus claves.";

/**
 * The three rows the dashboard's review shows before a signature: the vault
 * contract the distribution pays from, the function being signed, and the
 * custody rule. The recipients and amounts live in the modal's own body, not
 * here.
 */
export function distributionReviewRows(campaign: MyCampaign): readonly DistributionReviewRow[] {
  return [
    { label: "Contrato", value: campaign.vaultAddress, mono: true },
    { label: "Función", value: DISTRIBUTION_FUNCTION_LABEL },
    { label: "Custodia", value: CUSTODY_LABEL }
  ];
}
