import type { ApplicationReviewState } from "@vaqcrow/contracts";
import type {
  AdminDeployment,
  CampaignDeploymentState,
  DeployFailureCode
} from "@/application/ports/admin-review-port";
import { formatAssessmentTimestamp } from "./assessment";

/**
 * Pure view model of the admin review's deployment panel (#410 / U6, owner
 * decision D3). React-free: the panel and its hook only render what this
 * returns.
 *
 * D3 states, verbatim: `Pendiente de confirmación` → `Desplegando bóveda` →
 * `Bóveda confirmada / PyME publicada`, or `Despliegue fallido` with
 * Reintentar and a read-only Ver detalle. Only the confirmed state, the one
 * outcome Stellar Testnet confirmed, takes the success tone (`demo-ui.md` §2:
 * pending is never confirmed); every state carries its own icon and text, so
 * colour is never the only signal. The API's `lastError` is a sanitized code:
 * it maps to fixed Spanish copy and an unknown value is never echoed.
 */

export const DEPLOYMENT_COPY = Object.freeze({
  title: "Despliegue de la bóveda",
  testnet: "TESTNET",
  loading: "Consultando el estado del despliegue…",
  missing:
    "Todavía no hay un despliegue registrado para esta aprobación. Puede tardar unos segundos en aparecer; actualizá para volver a consultar.",
  readError:
    "No pudimos leer el estado del despliegue. No sabemos si la bóveda está confirmada; actualizá para volver a consultar.",
  refresh: "Actualizar",
  retry: "Reintentar",
  retrying: "Reintentando…",
  showDetails: "Ver detalle",
  hideDetails: "Ocultar detalle",
  unknownError: "No quedó registrado el motivo del fallo.",
  attempts: "Intentos",
  lastError: "Último error",
  campaignId: "ID de campaña",
  createdAt: "Registrado",
  updatedAt: "Última actualización"
});

/** What the panel's hook read: a deployment record, or a 404 (none recorded yet). */
export type DeploymentRead =
  | { readonly kind: "record"; readonly deployment: AdminDeployment }
  | { readonly kind: "missing" };

export type DeploymentTone = "neutral" | "info" | "success" | "critical";

export interface DeploymentStatusView {
  readonly label: string;
  readonly tone: DeploymentTone;
  readonly icon: CampaignDeploymentState;
  readonly message: string;
  readonly canRetry: boolean;
}

export interface DeploymentDetail {
  readonly term: string;
  readonly value: string;
}

const ERROR_TEXT: Readonly<Record<string, string>> = Object.freeze({
  owner_unresolved: "No se pudo identificar la cuenta titular de la solicitud.",
  terms_unavailable: "No se encontraron los términos de la campaña (objetivo y plazo) registrados para esta solicitud.",
  wallet_required: "No hay una wallet de Stellar registrada como destino de la bóveda.",
  goal_limit_exceeded: "El objetivo convertido supera el tope vigente por campaña.",
  rate_unavailable: "No había una tasa ARS/USD vigente para convertir el objetivo; no depende de la PyME.",
  unavailable: "Un servicio necesario (base de datos o Stellar Testnet) no respondió; no depende de la PyME.",
  application_not_found: "No se encontró la solicitud.",
  application_not_approved: "La solicitud no figuraba como aprobada."
});

const STATUS: Readonly<Record<CampaignDeploymentState, Omit<DeploymentStatusView, "message" | "icon">>> = Object.freeze({
  pending: { label: "Pendiente de confirmación", tone: "neutral", canRetry: false },
  deploying: { label: "Desplegando bóveda", tone: "info", canRetry: false },
  confirmed: { label: "Bóveda confirmada / PyME publicada", tone: "success", canRetry: false },
  failed: { label: "Despliegue fallido", tone: "critical", canRetry: true }
});

/** Shown while the review is approved, or whenever a deployment record exists. */
export function deploymentPanelVisible(state: ApplicationReviewState, read: DeploymentRead | undefined): boolean {
  return state === "approved" || read?.kind === "record";
}

/** Polling only makes sense while the outcome is still open. */
export function deploymentShouldPoll(read: DeploymentRead | undefined): boolean {
  return read?.kind === "record" && (read.deployment.state === "pending" || read.deployment.state === "deploying");
}

/** Honest Spanish text for a sanitized failure code; an unknown or absent code is never echoed. */
export function deploymentErrorText(code: string | null): string {
  return (code !== null && Object.hasOwn(ERROR_TEXT, code) ? ERROR_TEXT[code] : undefined) ?? DEPLOYMENT_COPY.unknownError;
}

export function deploymentStatusFor(deployment: AdminDeployment): DeploymentStatusView {
  const base = STATUS[deployment.state];
  return { ...base, icon: deployment.state, message: statusMessage(deployment) };
}

function statusMessage(deployment: AdminDeployment): string {
  switch (deployment.state) {
    case "pending":
      return "El despliegue de la bóveda en Stellar Testnet todavía no está confirmado. Esta vista se actualiza sola.";
    case "deploying":
      return "Se está desplegando la bóveda en Stellar Testnet. Todavía no está confirmada; esta vista se actualiza sola.";
    case "confirmed":
      return "La bóveda quedó confirmada en Stellar Testnet y la PyME fue publicada. Es Testnet: los activos no tienen valor económico.";
    case "failed":
      return `La bóveda no quedó confirmada. ${deploymentErrorText(deployment.lastError)}`;
  }
}

/** Why a Reintentar did not end in a confirmed vault; never claims it did. */
export function deployFailureMessage(code: DeployFailureCode): string {
  switch (code) {
    case "application_not_found":
      return "No encontramos la solicitud, así que no se reintentó el despliegue.";
    case "application_not_approved":
      return "La solicitud ya no figura como aprobada, así que no se reintentó el despliegue.";
    case "unavailable":
    case "network":
      return "No pudimos confirmar el resultado del reintento. Revisá el estado actualizado antes de volver a intentar.";
    default:
      return `El reintento no se completó: ${deploymentErrorText(code)}`;
  }
}

/** Read-only details for Ver detalle: attempts, last error, campaign id once confirmed, timestamps. */
export function deploymentDetails(deployment: AdminDeployment): readonly DeploymentDetail[] {
  return [
    { term: DEPLOYMENT_COPY.attempts, value: String(deployment.attempts) },
    ...(deployment.state === "failed"
      ? [{ term: DEPLOYMENT_COPY.lastError, value: deploymentErrorText(deployment.lastError) }]
      : []),
    ...(deployment.state === "confirmed" && deployment.campaignId !== null
      ? [{ term: DEPLOYMENT_COPY.campaignId, value: deployment.campaignId }]
      : []),
    { term: DEPLOYMENT_COPY.createdAt, value: formatAssessmentTimestamp(deployment.createdAt) },
    { term: DEPLOYMENT_COPY.updatedAt, value: formatAssessmentTimestamp(deployment.updatedAt) }
  ];
}
