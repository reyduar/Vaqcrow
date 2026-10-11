import type { DisclosureId } from "../trust/disclosures";

/**
 * «Términos y Condiciones» copy (Feature #394 / WU5), React-free so the modal
 * (`presentation/components/legal/terms-modal.tsx`) is its only renderer.
 *
 * Owner decision (2026-10-10): «Términos» is a **modal**, not a page, opened
 * from the shared `SiteFooter` so it is reachable from every page. The copy
 * describes the REAL state of this project — a non-production academic demo
 * (TFM), everything on Stellar Testnet with no economic value, non-custodial,
 * with simulated KYC/KYB and sales and an advisory-only AI, and neither an
 * investment offer, financial advice nor regulatory approval.
 *
 * The four sections that map one-to-one to a canonical notice declare the
 * disclosure id and are rendered by `CanonicalDisclosure`; their copy is never
 * retyped or paraphrased here (see `application/trust/disclosures.ts`).
 */

export interface TermsSection {
  readonly id: string;
  readonly heading: string;
  /** Free-text clauses in the owner's voice; omitted when the section only renders a canonical notice. */
  readonly body?: readonly string[];
  /** When set, the modal renders `CanonicalDisclosure` for this notice. */
  readonly disclosure?: DisclosureId;
}

const TERMS_SECTIONS: readonly TermsSection[] = Object.freeze([
  Object.freeze({
    id: "aceptacion",
    heading: "Aceptación",
    body: Object.freeze([
      "Al acceder o usar Vaqcrow, aceptás estos Términos y Condiciones. Si no estás de acuerdo con ellos, no uses la aplicación."
    ])
  }),
  Object.freeze({
    id: "servicio",
    heading: "Qué es Vaqcrow",
    body: Object.freeze([
      "Vaqcrow conecta PyMEs argentinas que buscan financiamiento con personas que aportan capital a cambio de una participación en los ingresos futuros de la PyME (revenue share). Cada campaña se financia a través de una bóveda de un contrato inteligente en Stellar Testnet."
    ])
  }),
  Object.freeze({
    id: "demo",
    heading: "Naturaleza de la demo",
    body: Object.freeze([
      "Vaqcrow es un Trabajo Fin de Máster en Desarrollo con IA. Es una demo técnica y académica: no es un servicio comercial y puede cambiar o discontinuarse sin aviso previo."
    ])
  }),
  Object.freeze({
    id: "sin-oferta",
    heading: "Sin oferta de inversión ni asesoramiento",
    disclosure: "no-production"
  }),
  Object.freeze({
    id: "testnet",
    heading: "Stellar Testnet y valor económico",
    disclosure: "testnet"
  }),
  Object.freeze({
    id: "no-custodial",
    heading: "Firma no custodial",
    disclosure: "non-custody"
  }),
  Object.freeze({
    id: "datos",
    heading: "Datos simulados",
    disclosure: "simulation"
  }),
  Object.freeze({
    id: "ia",
    heading: "La IA es asesora, no decide",
    disclosure: "human-ai"
  }),
  Object.freeze({
    id: "elegibilidad",
    heading: "Elegibilidad",
    body: Object.freeze([
      "Vaqcrow es una demostración: podés usarla para explorar el flujo completo, pero no para invertir ni para financiar un negocio real. Debés ser mayor de edad y usarla sólo con fines de estudio o evaluación."
    ])
  }),
  Object.freeze({
    id: "propiedad",
    heading: "Propiedad intelectual",
    body: Object.freeze([
      "El código, el diseño, los textos y las marcas de Vaqcrow pertenecen a su autor. Podés explorar la aplicación, pero no reutilizar sus contenidos sin autorización."
    ])
  }),
  Object.freeze({
    id: "responsabilidad",
    heading: "Limitación de responsabilidad",
    body: Object.freeze([
      "Vaqcrow se ofrece tal cual, como demo. No respondemos por daños que surjan del uso de la aplicación ni por decisiones que tomes a partir de su contenido. Como no hay dinero real involucrado, tampoco hay pérdidas económicas que reclamar."
    ])
  }),
  Object.freeze({
    id: "cambios",
    heading: "Cambios a estos términos",
    body: Object.freeze([
      "Podemos actualizar estos Términos y Condiciones cuando cambie la demo. La versión vigente es la que se muestra en este modal. Si seguís usando Vaqcrow después de un cambio, aceptás la nueva versión."
    ])
  }),
  Object.freeze({
    id: "contacto",
    heading: "Contacto",
    body: Object.freeze([
      "Para consultas sobre estos Términos y Condiciones, escribinos a contact@vaqcrow.com."
    ])
  })
] as const);

export const TERMS_COPY = Object.freeze({
  title: "Términos y Condiciones",
  intro:
    "Estos Términos y Condiciones regulan el uso de Vaqcrow, una demo académica de financiamiento por revenue share sobre Stellar Testnet. Leelos antes de usar la aplicación.",
  sections: TERMS_SECTIONS,
  contact: Object.freeze({
    label: "Escribir al equipo",
    href: "mailto:contact@vaqcrow.com"
  })
});
