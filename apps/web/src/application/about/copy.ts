import type { DisclosureId } from "../trust/disclosures";

/**
 * «Acerca de» (`/about`) copy, Feature #394 / WU1. React-free so the page's
 * container and sections share one source; the presentation layer (WU2)
 * renders it. Verbatim from `docs/design/template/Vaqcrow Acerca de.dc.html`:
 * hero `:58-67`, demo card `:71-86`, misión `:91-102`, pilares `:104-126`,
 * creador `:128-154`, hablemos `:156-170`.
 *
 * Two owner decisions shape this file:
 * - «Hablemos» carries the real destinations (LinkedIn, Discord, Email,
 *   GitHub) the owner chose on 2026-10-10, not the template's `#`.
 * - The academic callout keeps only its academic lead; the canonical
 *   no-production sentence is rendered through `CanonicalDisclosure` and is
 *   never retyped here.
 */

export interface AboutLink {
  readonly label: string;
  readonly href: string;
}

export interface AboutStackRow {
  readonly icon: string;
  readonly label: string;
  readonly tag: string;
}

export interface AboutPillar {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
}

export interface AboutStat {
  readonly label: string;
  readonly value: string;
}

export const ABOUT_COPY = Object.freeze({
  hero: Object.freeze({
    headingId: "ab-t",
    eyebrow: "Financiamiento PyME · Stellar Testnet",
    /** The `<h1>` as the template splits it: «Acerca de » + accented «Vaqcrow». */
    titleLead: "Acerca de ",
    titleAccent: "Vaqcrow",
    subtitleLead: "Financiamiento trazable por ",
    subtitleStrong: "revenue share",
    subtitleTail:
      " para PyMEs argentinas, con evaluación de IA explicable y liquidación no custodial sobre Stellar Testnet.",
    ctas: Object.freeze([
      Object.freeze({ label: "Conocer la plataforma", href: "/" }),
      Object.freeze({ label: "Sobre el creador", href: "#creador" })
    ] as const)
  }),
  stack: Object.freeze({
    title: "Stellar Testnet · Soroban",
    subtitle: "Cómo está construida la demo",
    badge: "TESTNET",
    footnote: "Activos de prueba sin valor económico.",
    rows: Object.freeze([
      Object.freeze({ icon: "analytics-outline", label: "IA consultiva y explicable", tag: "decisión humana" }),
      Object.freeze({ icon: "key-outline", label: "Firma no custodial", tag: "Freighter" }),
      Object.freeze({ icon: "cube-outline", label: "Custodia por contrato", tag: "Soroban" }),
      Object.freeze({ icon: "receipt-outline", label: "Revenue share trazable", tag: "regla versionada" })
    ] as const)
  }),
  mission: Object.freeze({
    headingId: "mv-t",
    eyebrow: "Propósito",
    title: "Misión y visión",
    quote:
      "“Hacer el financiamiento productivo más simple, trazable y transparente, para que las PyMEs argentinas accedan a capital sin barreras ni intermediación innecesaria.”",
    body:
      "Combinamos análisis de riesgo asistido por IA explicable con liquidaciones en un contrato de Stellar, para que PyMEs y aportantes operen en un entorno verificable. En esta demo, todo corre en Testnet con datos sintéticos."
  }),
  pillars: Object.freeze({
    headingId: "que-t",
    eyebrow: "Pilares",
    title: "¿Qué es Vaqcrow?",
    intro:
      "Un marketplace de financiamiento por revenue share para PyMEs argentinas. Esta versión opera con datos simulados, como demostración y validación tecnológica.",
    academicCallout: Object.freeze({
      /** The dashed callout's own lead; its body is the canonical disclosure. */
      title: "Proyecto académico · Trabajo Fin de Máster en Desarrollo con IA",
      /** Rendered by `CanonicalDisclosure`; the sentence is never retyped here. */
      disclosure: "no-production" as DisclosureId
    }),
    items: Object.freeze([
      Object.freeze({
        icon: "document-text-outline",
        title: "Onboarding y KYC simulado",
        body: "Identidad, KYC/KYB y ventas de cada PyME, con su origen declarado. En esta demo son sintéticos y llevan la marca SIMULADO."
      }),
      Object.freeze({
        icon: "analytics-outline",
        title: "Evaluación de IA consultiva",
        body: "La IA organiza evidencia, marca anomalías y propone una evaluación explicable. “La IA recomienda; una persona decide.”"
      }),
      Object.freeze({
        icon: "person-outline",
        title: "Decisión humana atribuida",
        body: "Cada aprobación la registra una persona, con razón, límite y fecha. La recomendación de IA no aprueba ni transfiere fondos."
      }),
      Object.freeze({
        icon: "key-outline",
        title: "Firma no custodial",
        body: "Integración con Freighter: la persona conserva sus claves y Vaqcrow nunca recibe su seed."
      }),
      Object.freeze({
        icon: "cube-outline",
        title: "Bóveda en Stellar Testnet",
        body: "Los aportes los custodia un contrato de Soroban. Al alcanzar la meta, liquida a la PyME; si vence, habilita el reembolso."
      }),
      Object.freeze({
        icon: "layers-outline",
        title: "Portafolio y evidencia",
        body: "Portafolio, billetera, informes y administración, con hashes verificables en el explorador."
      })
    ] as const)
  }),
  creator: Object.freeze({
    sectionId: "creador",
    headingId: "cr-t",
    eyebrow: "Sobre el creador",
    name: "Ariel Duarte",
    role: "Senior Software Engineer · Diseñador del sistema Vaqcrow",
    bio: "Senior Software Engineer con más de 16 años de experiencia construyendo arquitecturas escalables, plataformas fintech y sistemas de compliance de alto rendimiento. Diseñó y desarrolló Vaqcrow como Trabajo Fin de Máster en Desarrollo con IA, combinando modelos de lenguaje explicables con la infraestructura de Stellar y Soroban.",
    /** `creador-gris.png` placeholder alt from the template's image-slot. */
    photoAlt: "Foto de Ariel Duarte",
    experienceBadge: Object.freeze({ value: "16+ años", label: "de experiencia técnica" }),
    stats: Object.freeze([
      Object.freeze({ label: "Experiencia", value: "16+ años" }),
      Object.freeze({ label: "Dominio", value: "Fintech y KYC" }),
      Object.freeze({ label: "Stack", value: "Stellar y Soroban" })
    ] as const),
    /**
     * The template's href is a placeholder `#`; no real destination was
     * decided (the owner's real links are the four «Hablemos» CTAs).
     * Owner-pending, flagged in the WU1 report.
     */
    profileCta: "Ver perfil profesional completo"
  }),
  contact: Object.freeze({
    sectionId: "contacto",
    headingId: "ct-t",
    title: "Hablemos",
    body: "Disponible para consultoría, proyectos de alta complejidad o para intercambiar ideas sobre finanzas digitales y blockchain.",
    ctas: Object.freeze([
      Object.freeze({ label: "LinkedIn", href: "https://www.linkedin.com/in/arielduarte" }),
      Object.freeze({ label: "Discord", href: "https://discord.gg/XnsH2FvSr" }),
      Object.freeze({ label: "Email", href: "mailto:contact@vaqcrow.com" }),
      Object.freeze({ label: "GitHub", href: "https://github.com/reyduar" })
    ] as const)
  })
});
