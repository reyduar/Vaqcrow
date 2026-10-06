import type { Role } from "../ports/auth-port.js";

/**
 * The notification catalogue (Feature #382, Task #383 / T1b-1).
 *
 * A single **pure** module — no React, no vendor, no I/O — that maps each
 * product event to its audience, its in-app copy and its email copy. All copy
 * lives here so a later edit is one file: this draft (v1) is pending the
 * owner's approval, and the e-mail body is derived from the in-app render
 * rather than duplicated.
 *
 * `renderEmail` takes the absolute base URL as an argument, never reading the
 * environment: the catalogue stays pure and a caller can render a link against
 * whatever host it is actually running behind.
 */

/**
 * The closed set of event types the product can raise. The database stores
 * `event_type` as free text on purpose (it evolves with the catalogue), so this
 * union is the application-layer validation the migration deliberately left
 * out.
 */
export const NOTIFICATION_EVENT_TYPES = [
  "admin.new_application",
  "admin.pending_transaction",
  "admin.goal_reached",
  "admin.operator_invited",
  "pyme.changes_requested",
  "pyme.rejected",
  "pyme.approved_published",
  "pyme.goal_reached",
  "pyme.declare_sales",
  "pyme.distribution_ready",
  "investor.contribution_confirmed",
  "investor.goal_reached",
  "investor.distribution_received",
  "investor.refund_available"
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

/**
 * The data each event needs. Deliberately minimal — only what the copy
 * interpolates — and discriminated by `type`, so `renderInApp` and `renderEmail`
 * can narrow a variant by switching on `payload.type`.
 */
export type NotificationPayload =
  | { readonly type: "admin.new_application"; readonly smeName: string }
  | { readonly type: "admin.pending_transaction" }
  | { readonly type: "admin.goal_reached"; readonly smeName: string }
  | { readonly type: "admin.operator_invited" }
  | { readonly type: "pyme.changes_requested" }
  | { readonly type: "pyme.rejected" }
  | { readonly type: "pyme.approved_published" }
  | { readonly type: "pyme.goal_reached" }
  | { readonly type: "pyme.declare_sales" }
  | { readonly type: "pyme.distribution_ready" }
  | { readonly type: "investor.contribution_confirmed"; readonly smeName: string }
  | { readonly type: "investor.goal_reached"; readonly smeName: string }
  | { readonly type: "investor.distribution_received"; readonly smeName: string }
  | { readonly type: "investor.refund_available" };

/** Which role receives each event. `resolveRecipientsByRole` fans this out. */
export const NOTIFICATION_AUDIENCE: Readonly<Record<NotificationEventType, Role>> = Object.freeze({
  "admin.new_application": "ADMIN",
  "admin.pending_transaction": "ADMIN",
  "admin.goal_reached": "ADMIN",
  "admin.operator_invited": "ADMIN",
  "pyme.changes_requested": "PYME",
  "pyme.rejected": "PYME",
  "pyme.approved_published": "PYME",
  "pyme.goal_reached": "PYME",
  "pyme.declare_sales": "PYME",
  "pyme.distribution_ready": "PYME",
  "investor.contribution_confirmed": "INVERSOR",
  "investor.goal_reached": "INVERSOR",
  "investor.distribution_received": "INVERSOR",
  "investor.refund_available": "INVERSOR"
});

export interface RenderedInAppNotification {
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string | undefined;
  readonly ctaHref: string | undefined;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly body: string;
}

/**
 * The plain-text footer on every email. Names the demo and its Testnet scope,
 * and tells the recipient not to reply — this is a transactional, no-reply
 * message.
 */
export const EMAIL_FOOTER =
  "Vaqcrow · Demo en Stellar Testnet. Este mensaje es automático; no respondas a este correo.";

/** The in-app copy for one event, with `{smeName}` already interpolated. */
export function renderInApp(payload: NotificationPayload): RenderedInAppNotification {
  switch (payload.type) {
    case "admin.new_application":
      return {
        title: `Nueva solicitud: ${payload.smeName}`,
        body: `${payload.smeName} envió su solicitud a revisión.`,
        ctaLabel: "Revisar solicitud",
        ctaHref: "/admin"
      };
    case "admin.pending_transaction":
      return {
        title: "Transacción pendiente de confirmación",
        body: "Una operación en Stellar Testnet espera la confirmación del ledger.",
        ctaLabel: "Ver operaciones",
        ctaHref: "/admin"
      };
    case "admin.goal_reached":
      return {
        title: `Meta alcanzada: ${payload.smeName}`,
        body: `La bóveda de ${payload.smeName} alcanzó la meta. El contrato liquidó a la PyME (Testnet).`,
        ctaLabel: "Ver campaña",
        ctaHref: "/admin"
      };
    case "admin.operator_invited":
      return {
        title: "Operador invitado",
        body: "Se invitó a un nuevo operador al panel de administración.",
        ctaLabel: "Ver usuarios",
        ctaHref: "/admin"
      };
    case "pyme.changes_requested":
      return {
        title: "Te pidieron cambios en tu solicitud",
        body: "Revisá las observaciones del equipo y volvé a enviarla.",
        ctaLabel: "Ver mi campaña",
        ctaHref: "/company"
      };
    case "pyme.rejected":
      return {
        title: "Tu solicitud fue rechazada",
        body: "El equipo revisó tu solicitud y no fue aprobada. Podés ver el detalle en tu campaña.",
        ctaLabel: "Ver mi campaña",
        ctaHref: "/company"
      };
    case "pyme.approved_published":
      return {
        title: "Tu campaña fue aprobada y publicada",
        body: "Ya podés recibir aportes en Stellar Testnet.",
        ctaLabel: "Ver mi campaña",
        ctaHref: "/company"
      };
    case "pyme.goal_reached":
      return {
        title: "¡Alcanzaste tu meta!",
        body: "Tu bóveda alcanzó la meta. Ahora llegan las distribuciones de revenue share.",
        ctaLabel: "Ver mi campaña",
        ctaHref: "/company"
      };
    case "pyme.declare_sales":
      return {
        title: "Es hora de declarar tus ventas del mes",
        body: "Cargá las ventas del mes para calcular la distribución.",
        ctaLabel: "Declarar ventas",
        ctaHref: "/company"
      };
    case "pyme.distribution_ready":
      return {
        title: "Tenés una distribución lista para firmar",
        body: "Firmá con Freighter para distribuir el revenue share.",
        ctaLabel: "Firmar distribución",
        ctaHref: "/company"
      };
    case "investor.contribution_confirmed":
      return {
        title: "Tu aporte se confirmó",
        body: `Tu aporte a ${payload.smeName} quedó registrado en Stellar Testnet.`,
        ctaLabel: "Ver mi portafolio",
        ctaHref: "/portfolio"
      };
    case "investor.goal_reached":
      return {
        title: "La campaña que apoyás alcanzó la meta",
        body: `${payload.smeName} alcanzó su meta. El contrato custodia los fondos.`,
        ctaLabel: "Ver mi portafolio",
        ctaHref: "/portfolio"
      };
    case "investor.distribution_received":
      return {
        title: "Recibiste una distribución",
        body: `Se acreditó una distribución de revenue share de ${payload.smeName}.`,
        ctaLabel: "Ver mi portafolio",
        ctaHref: "/portfolio"
      };
    case "investor.refund_available":
      return {
        title: "Podés pedir el reembolso de tu aporte",
        body: "La campaña no alcanzó la meta. Podés retirar tu aporte desde el contrato.",
        ctaLabel: "Ver mi portafolio",
        ctaHref: "/portfolio"
      };
    default:
      return assertNever(payload);
  }
}

/**
 * The email copy for one event. `subject` is the notification title; the body
 * is the notification body, the absolute CTA link and the demo footer, each
 * separated by a blank line. `appBaseUrl` is supplied by the caller so the
 * catalogue never reads the environment.
 */
export function renderEmail(payload: NotificationPayload, appBaseUrl: string): RenderedEmail {
  const rendered = renderInApp(payload);
  const lines = [rendered.body];

  if (rendered.ctaLabel !== undefined && rendered.ctaHref !== undefined) {
    lines.push(`${rendered.ctaLabel}: ${appBaseUrl}${rendered.ctaHref}`);
  }

  lines.push(EMAIL_FOOTER);

  return { subject: rendered.title, body: lines.join("\n\n") };
}

/** Exhaustiveness guard: a new event type without copy fails the build, not a runtime lookup. */
function assertNever(value: never): never {
  throw new Error(`unhandled notification event type: ${JSON.stringify(value)}`);
}
