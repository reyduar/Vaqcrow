import { describe, expect, it } from "vitest";
import type { Role } from "../ports/auth-port.js";
import {
  EMAIL_FOOTER,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_EVENT_TYPES,
  renderEmail,
  renderInApp
} from "./notification-catalogue.js";
import type { NotificationPayload } from "./notification-catalogue.js";

/**
 * The catalogue is pure: every title, body and CTA below is asserted verbatim,
 * so a copy edit is a deliberate test change rather than a silent drift. The
 * email body is derived from the same rendered copy plus the absolute link the
 * caller supplies, which is why no test reads `process.env`.
 *
 * This copy is DRAFT v1 pending the owner's approval.
 */

const SME = "Panadería La Espiga";
const BASE_URL = "https://vaqcrow.example.test";

interface CatalogueCase {
  readonly payload: NotificationPayload;
  readonly audience: Role;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly ctaHref: string;
}

const CATALOGUE: readonly CatalogueCase[] = [
  {
    payload: { type: "admin.new_application", smeName: SME },
    audience: "ADMIN",
    title: `Nueva solicitud: ${SME}`,
    body: `${SME} envió su solicitud a revisión.`,
    ctaLabel: "Revisar solicitud",
    ctaHref: "/admin"
  },
  {
    payload: { type: "admin.pending_transaction" },
    audience: "ADMIN",
    title: "Transacción pendiente de confirmación",
    body: "Una operación en Stellar Testnet espera la confirmación del ledger.",
    ctaLabel: "Ver operaciones",
    ctaHref: "/admin"
  },
  {
    payload: { type: "admin.goal_reached", smeName: SME },
    audience: "ADMIN",
    title: `Meta alcanzada: ${SME}`,
    body: `La bóveda de ${SME} alcanzó la meta. El contrato liquidó a la PyME (Testnet).`,
    ctaLabel: "Ver campaña",
    ctaHref: "/admin"
  },
  {
    payload: { type: "admin.operator_invited" },
    audience: "ADMIN",
    title: "Operador invitado",
    body: "Se invitó a un nuevo operador al panel de administración.",
    ctaLabel: "Ver usuarios",
    ctaHref: "/admin"
  },
  {
    payload: { type: "pyme.changes_requested" },
    audience: "PYME",
    title: "Te pidieron cambios en tu solicitud",
    body: "Revisá las observaciones del equipo y volvé a enviarla.",
    ctaLabel: "Ver mi campaña",
    ctaHref: "/company"
  },
  {
    payload: { type: "pyme.rejected" },
    audience: "PYME",
    title: "Tu solicitud fue rechazada",
    body: "El equipo revisó tu solicitud y no fue aprobada. Podés ver el detalle en tu campaña.",
    ctaLabel: "Ver mi campaña",
    ctaHref: "/company"
  },
  {
    payload: { type: "pyme.approved_published" },
    audience: "PYME",
    title: "Tu campaña fue aprobada y publicada",
    body: "Ya podés recibir aportes en Stellar Testnet.",
    ctaLabel: "Ver mi campaña",
    ctaHref: "/company"
  },
  {
    payload: { type: "pyme.goal_reached" },
    audience: "PYME",
    title: "¡Alcanzaste tu meta!",
    body: "Tu bóveda alcanzó la meta. Ahora llegan las distribuciones de revenue share.",
    ctaLabel: "Ver mi campaña",
    ctaHref: "/company"
  },
  {
    payload: { type: "pyme.declare_sales" },
    audience: "PYME",
    title: "Es hora de declarar tus ventas del mes",
    body: "Cargá las ventas del mes para calcular la distribución.",
    ctaLabel: "Declarar ventas",
    ctaHref: "/company"
  },
  {
    payload: { type: "pyme.distribution_ready" },
    audience: "PYME",
    title: "Tenés una distribución lista para firmar",
    body: "Firmá con Freighter para distribuir el revenue share.",
    ctaLabel: "Firmar distribución",
    ctaHref: "/company"
  },
  {
    payload: { type: "investor.contribution_confirmed", smeName: SME },
    audience: "INVERSOR",
    title: "Tu aporte se confirmó",
    body: `Tu aporte a ${SME} quedó registrado en Stellar Testnet.`,
    ctaLabel: "Ver mi portafolio",
    ctaHref: "/portfolio"
  },
  {
    payload: { type: "investor.goal_reached", smeName: SME },
    audience: "INVERSOR",
    title: "La campaña que apoyás alcanzó la meta",
    body: `${SME} alcanzó su meta. El contrato custodia los fondos.`,
    ctaLabel: "Ver mi portafolio",
    ctaHref: "/portfolio"
  },
  {
    payload: { type: "investor.distribution_received", smeName: SME },
    audience: "INVERSOR",
    title: "Recibiste una distribución",
    body: `Se acreditó una distribución de revenue share de ${SME}.`,
    ctaLabel: "Ver mi portafolio",
    ctaHref: "/portfolio"
  },
  {
    payload: { type: "investor.refund_available" },
    audience: "INVERSOR",
    title: "Podés pedir el reembolso de tu aporte",
    body: "La campaña no alcanzó la meta. Podés retirar tu aporte desde el contrato.",
    ctaLabel: "Ver mi portafolio",
    ctaHref: "/portfolio"
  }
];

describe("notification catalogue completeness", () => {
  it("covers every declared event type exactly once", () => {
    expect(CATALOGUE).toHaveLength(14);
    expect(NOTIFICATION_EVENT_TYPES).toHaveLength(14);
    expect(new Set(CATALOGUE.map((entry) => entry.payload.type))).toEqual(
      new Set(NOTIFICATION_EVENT_TYPES)
    );
  });

  it("has no duplicate event type", () => {
    const types = CATALOGUE.map((entry) => entry.payload.type);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe("renderInApp and audience", () => {
  it.each(CATALOGUE)("renders $payload.type verbatim for its audience", (entry) => {
    expect(renderInApp(entry.payload)).toEqual({
      title: entry.title,
      body: entry.body,
      ctaLabel: entry.ctaLabel,
      ctaHref: entry.ctaHref
    });
    expect(NOTIFICATION_AUDIENCE[entry.payload.type]).toBe(entry.audience);
  });
});

describe("renderEmail", () => {
  it.each(CATALOGUE)("uses the notification title as the subject for $payload.type", (entry) => {
    const email = renderEmail(entry.payload, BASE_URL);

    expect(email.subject).toBe(entry.title);
    expect(email.body).toContain(entry.body);
    expect(email.body).toContain(`${entry.ctaLabel}: ${BASE_URL}${entry.ctaHref}`);
    expect(email.body).toContain(EMAIL_FOOTER);
  });

  it("builds the absolute CTA link from the base URL it is given, not a fixed one", () => {
    const payload: NotificationPayload = { type: "investor.contribution_confirmed", smeName: SME };

    expect(renderEmail(payload, "https://one.example.test").body).toContain(
      "Ver mi portafolio: https://one.example.test/portfolio"
    );
    expect(renderEmail(payload, "https://two.example.test").body).toContain(
      "Ver mi portafolio: https://two.example.test/portfolio"
    );
  });

  it("lays the email out as body, CTA link and footer, separated by blank lines", () => {
    const email = renderEmail({ type: "pyme.approved_published" }, BASE_URL);

    expect(email.body).toBe(
      [
        "Ya podés recibir aportes en Stellar Testnet.",
        `Ver mi campaña: ${BASE_URL}/company`,
        EMAIL_FOOTER
      ].join("\n\n")
    );
  });

  it("declares the demo and Testnet scope in its footer", () => {
    expect(EMAIL_FOOTER).toContain("Stellar Testnet");
    expect(EMAIL_FOOTER).toContain("no respondas a este correo");
  });
});
