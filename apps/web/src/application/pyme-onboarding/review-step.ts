import type { SmeRequestFormValues } from "@/application/evidence/review-view-model";
import { cuitDigits, parseAmount, type RegistrationValues } from "./registration-step";

/**
 * Pure copy and state of the PyME onboarding wizard's step 4 («Revisión
 * humana», Feature #398, Task #399 / T5). React-free so the next-steps model,
 * the request mapping and the copy are unit-tested without rendering.
 *
 * Copy is verbatim from the owner's template
 * `docs/design/template/Vaqcrow Onboarding PyME.dc.html` (export 2026-10-03),
 * lines 227–257 and the `nextSteps` list on line 359. The template hardcodes a
 * mock public key (`GBXK…7Q2M`); this model truncates the actually connected
 * key instead, so no fake address is shown to a real person. The send is the
 * explicit action of D12 (owner, 2026-10-03): the PyME itself presses «Enviar
 * a revisión», with a connected Freighter wallet as the vault's immutable
 * destination. The vault deploy stays platform-signed.
 */

export type ReviewStepIcon = "document" | "check" | "analytics" | "wallet" | "person" | "cube";

/** `err`/`warn`/`ok` colour the row; the state text always carries the meaning. */
export type ReviewStepTone = "ok" | "warn" | "err" | "none";

export interface ReviewNextStep {
  readonly icon: ReviewStepIcon;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly tone: ReviewStepTone;
}

export const REVIEW_STEP_COPY = Object.freeze({
  heading: "Qué pasa ahora",
  notSentTitle: "Revisá y enviá tu solicitud.",
  notSentBody: "Todavía no fue enviada a revisión.",
  sentBannerTitle: "Solicitud enviada · en revisión.",
  sentBannerBody: "Todavía no está aprobada ni publicada.",
  sentSuccess: "Solicitud enviada a revisión. Te avisamos cuando haya una decisión.",
  send: "Enviar a revisión",
  sending: "Enviando…",
  edit: "Revisar lo cargado",
  goToCompany: "Ir a Mi campaña",
  walletAlert: "Conectá tu wallet Freighter para poder enviar la solicitud a revisión.",
  connectWallet: "Conectar Freighter",
  connecting: "Conectando…",
  pending: "Pendiente",
  complete: "Completo",
  obligatorio: "Obligatorio",
  enProceso: "En proceso",
  // New copy (neutral Spanish, voseo) for the states the template does not draw.
  sendUnavailable: "El servicio de solicitudes no está disponible en esta demostración. No se envió nada.",
  sendFailed: "No pudimos enviar tu solicitud. Probá de nuevo.",
  businessFailed: "No pudimos guardar los datos de tu empresa. No se envió la solicitud. Probá de nuevo.",
  connectFailed: "No pudimos conectar Freighter. Probá de nuevo."
});

/** First and last four characters, like the template's mock `GBXK…7Q2M`. */
export function shortPublicKey(publicKey: string): string {
  return `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`;
}

export interface ReviewNextStepsInput {
  readonly sent: boolean;
  readonly walletConnected: boolean;
  readonly walletTried: boolean;
  readonly publicKey: string | null;
}

/** Template line 359: the five steps, with their state and tone per situation. */
export function reviewNextSteps(input: ReviewNextStepsInput): readonly ReviewNextStep[] {
  const { sent, walletConnected, walletTried, publicKey } = input;

  const request: ReviewNextStep = sent
    ? {
        icon: "check",
        title: "Solicitud recibida",
        body: "Perfil, KYC y ventas guardados con su origen.",
        state: REVIEW_STEP_COPY.complete,
        tone: "ok"
      }
    : {
        icon: "document",
        title: "Solicitud lista",
        body: "Perfil, KYC y ventas cargados. Falta enviarla a revisión.",
        state: REVIEW_STEP_COPY.pending,
        tone: "none"
      };

  const wallet: ReviewNextStep = walletConnected
    ? {
        icon: "wallet",
        title: "Conectar Freighter",
        body: `Wallet Freighter conectada (${shortPublicKey(publicKey ?? "")} · Testnet). Su cuenta va a ser el destino inmutable de los fondos de la bóveda.`,
        state: REVIEW_STEP_COPY.complete,
        tone: "ok"
      }
    : {
        icon: "wallet",
        title: "Conectar Freighter",
        body: "Para abrir la bóveda es obligatorio que la PyME tenga una wallet Freighter conectada: su cuenta es el destino inmutable de los fondos.",
        state: walletTried ? REVIEW_STEP_COPY.obligatorio : REVIEW_STEP_COPY.pending,
        tone: walletTried ? "err" : "none"
      };

  return [
    request,
    {
      icon: "analytics",
      title: "Evaluación de IA",
      body: "Organizó la evidencia, marcó faltantes y anomalías y propuso una banda de riesgo.",
      state: REVIEW_STEP_COPY.complete,
      tone: "ok"
    },
    wallet,
    {
      icon: "person",
      title: "Revisión humana",
      body: "Una persona revisa y registra la decisión, con razón y fecha.",
      state: sent ? REVIEW_STEP_COPY.enProceso : REVIEW_STEP_COPY.pending,
      tone: sent ? "warn" : "none"
    },
    {
      icon: "cube",
      title: "Apertura de la bóveda",
      body: "Si se aprueba, la plataforma abre la bóveda en Testnet con tu cuenta como destino de los fondos.",
      state: REVIEW_STEP_COPY.pending,
      tone: "none"
    }
  ];
}

/** The demo's sales grid is the eight months of 2026 (template line 333). */
export const SALES_YEAR = 2026;

/**
 * Maps the wizard's form strings onto the existing SME-request contract. The
 * contract only carries a reference, a total and a period window: every other
 * collected field (reason, sector, description, goal, revenue share and the
 * uploaded documents) cannot travel through it and is left for #399/T3 — a
 * recorded seam, not an invented field.
 */
export function toSmeRequestValues(values: RegistrationValues): SmeRequestFormValues {
  const declaredTotalArs = values.sales
    .filter((raw) => raw !== "")
    .reduce((total, raw) => total + parseAmount(raw), 0);
  const months = Math.max(values.sales.length, 1);
  return {
    declaredTotalArs: String(declaredTotalArs),
    periodStart: `${SALES_YEAR}-01`,
    periodEnd: `${SALES_YEAR}-${String(months).padStart(2, "0")}`
  };
}

/** The CUIT digits identify the SME; the razón social is the fallback. */
export function smeReferenceFor(values: RegistrationValues): string {
  return cuitDigits(values.cuit) || values.name.trim();
}
