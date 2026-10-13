import type { Guide } from "./types";

/**
 * «Guía para emprendedores» (`/entrepreneur-guide`), Feature #394 / WU1.
 *
 * Verbatim from `docs/design/template/Vaqcrow Guia emprendedores.dc.html`:
 * hero `:105-112`, TOC `:114-123`, sections `:125-131`, final CTA `:132-134`.
 * The login gate (`:91-102`) is not modelled — the owner made the guides
 * public. CTA hrefs point at the real app routes (`/company` is the PyME area
 * that hosts the registration wizard); the template's `.dc.html` targets are
 * not app links.
 */
export const ENTREPRENEUR_GUIDE: Guide = Object.freeze({
  eyebrow: "Guía para emprendedores",
  eyebrowIcon: "storefront-outline",
  titleLead: "De tus ventas a una ",
  titleAccent: "campaña",
  subtitle:
    "Qué necesitás para registrar tu PyME, cómo se evalúa, cómo funciona la bóveda de tu campaña y qué pasa después del financiamiento.",
  note: "Guía educativa de una demo en Stellar Testnet. No es asesoramiento legal ni financiero, y la plataforma no garantiza que tu campaña se financie.",
  ctas: Object.freeze([
    Object.freeze({ label: "Registrar mi PyME", href: "/company" }),
    Object.freeze({ label: "Ver requisitos", href: "#requisitos" })
  ]),
  toc: Object.freeze([
    Object.freeze({ id: "requisitos", label: "Requisitos" }),
    Object.freeze({ id: "evidencia", label: "Evidencia" }),
    Object.freeze({ id: "evaluacion", label: "Evaluación" }),
    Object.freeze({ id: "boveda", label: "La bóveda" }),
    Object.freeze({ id: "meta", label: "La meta" }),
    Object.freeze({ id: "despues", label: "Después" }),
    Object.freeze({ id: "garantias", label: "Sin garantías" })
  ]),
  sections: Object.freeze([
    Object.freeze({
      id: "requisitos",
      headingId: "requisitos-t",
      index: "01",
      title: "Requisitos",
      body: "Vaqcrow financia PyMEs formales con ventas que se puedan verificar. Antes de empezar, asegurate de tener:",
      items: Object.freeze([
        "CUIT activo de la empresa y una persona responsable que complete el KYC.",
        "Al menos 6 meses de ventas declaradas; más historia ayuda a la evaluación.",
        "Un destino claro para los fondos: equipamiento, local, stock o capital de trabajo.",
        "Una wallet Freighter: su clave pública será el destino de tu bóveda y con ella vas a firmar las distribuciones mensuales."
      ])
    }),
    Object.freeze({
      id: "evidencia",
      headingId: "evidencia-t",
      index: "02",
      title: "Qué evidencia preparar",
      body: "Cada dato que cargues declara su origen y se muestra así a los aportantes. En la demo, todo es sintético y lleva la marca SIMULADO.",
      cards: Object.freeze([
        Object.freeze({
          icon: "id-card-outline",
          title: "KYC/KYB",
          body: "Identidad de la persona responsable y de la empresa."
        }),
        Object.freeze({
          icon: "bar-chart-outline",
          title: "Ventas mensuales",
          body: "Un valor por mes. Si falta un mes, queda como faltante, nunca como cero."
        }),
        Object.freeze({
          icon: "document-attach-outline",
          title: "Declaraciones",
          body: "Los comprobantes que respaldan cada período declarado."
        })
      ])
    }),
    Object.freeze({
      id: "evaluacion",
      headingId: "evaluacion-t",
      index: "03",
      title: "Evaluación y decisión",
      body: "La IA organiza tu evidencia, marca faltantes y anomalías y propone una banda de riesgo con su explicación. No aprueba nada: una persona revisa y registra la decisión, con nombre, razón, límite y fecha.",
      callout: Object.freeze({
        lead: "Si la decisión es ",
        strong: "requiere cambios",
        tail: ", vas a ver exactamente qué falta, por ejemplo la declaración de un mes o la explicación de una anomalía."
      })
    }),
    Object.freeze({
      id: "boveda",
      headingId: "boveda-t",
      index: "04",
      title: "La bóveda de tu campaña",
      body: "Si tu solicitud se aprueba, definís los términos de la campaña y Vaqcrow despliega la bóveda: un contrato de Stellar (Soroban) que custodia los aportes. El despliegue lo firma la plataforma, y el destino queda fijo a tu cuenta de liquidación (tu clave pública de Freighter). Vos no abrís ni firmás la bóveda: sólo conectás Freighter para dar tu clave pública antes de la revisión.",
      terms: Object.freeze([
        Object.freeze({ term: "Meta", definition: "Monto a reunir, dentro del límite aprobado." }),
        Object.freeze({ term: "Fecha límite", definition: "Hasta cuándo se aceptan aportes." }),
        Object.freeze({ term: "Revenue share", definition: "Porcentaje de tus ventas mensuales." }),
        Object.freeze({ term: "Aporte mínimo", definition: "Unidad mínima por aportante." }),
        Object.freeze({ term: "Regla de cálculo", definition: "Versionada; no cambia durante la campaña." }),
        Object.freeze({ term: "Destino", definition: "Tu cuenta de liquidación. Queda fijo e inmutable." })
      ]),
      callout: Object.freeze({
        lead: "",
        strong: "¿Esto es tokenizar mi empresa?",
        tail: " No. Vaqcrow no emite tokens ni fracciona la propiedad de tu PyME. Los aportantes no reciben acciones ni deuda negociable: reciben una participación contractual en tus ventas, y los fondos esperan en la bóveda hasta que se cumpla la meta."
      })
    }),
    Object.freeze({
      id: "meta",
      headingId: "meta-t",
      index: "05",
      title: "Si llegás o no a la meta",
      outcomes: Object.freeze([
        Object.freeze({
          icon: "checkmark-circle-outline",
          tone: "ok" as const,
          title: "Meta alcanzada",
          body: "El contrato la evalúa sobre el ledger y te liquida en la misma transacción. Un pago liquidado no se puede revertir."
        }),
        Object.freeze({
          icon: "return-down-back-outline",
          tone: "warn" as const,
          title: "Vence sin meta",
          body: "Se habilita el reembolso a los aportantes. No se dispara solo: alguien tiene que enviar la transacción."
        })
      ])
    }),
    Object.freeze({
      id: "despues",
      headingId: "despues-t",
      index: "06",
      title: "Después del financiamiento",
      body: "Cada mes declarás tus ventas. Vaqcrow calcula la distribución con la regla de tu campaña y vos la firmás en Freighter.",
      workedExample: Object.freeze({
        salesLabel: "Ventas declaradas de agosto",
        salesTag: "SIMULADO",
        salesValue: "ARS 3.745.800,00",
        ruleLabel: "Revenue share (regla RS-2026-01)",
        ruleValue: "× 4,5 %",
        resultLabel: "A distribuir entre aportantes",
        resultValue: "ARS 168.561,00",
        footnote: "Cálculo determinístico; la IA no calcula esta obligación"
      })
    }),
    Object.freeze({
      id: "garantias",
      headingId: "garantias-t",
      index: "07",
      title: "Qué no garantiza la plataforma",
      items: Object.freeze([
        "Que tu campaña alcance la meta.",
        "Aprobación regulatoria, ni una oferta pública de valores.",
        "Custodia por parte de Vaqcrow: los fondos los custodia el contrato.",
        "Operación real en Argentina: esta es una demo en Testnet con activos sin valor económico."
      ]),
      valuedTitle: "Qué valoran los aportantes",
      valued: Object.freeze([
        Object.freeze({
          icon: "eye-outline",
          title: "Transparencia",
          body: "Mostrar faltantes y anomalías, no esconderlos."
        }),
        Object.freeze({
          icon: "calendar-outline",
          title: "Constancia",
          body: "Declarar las ventas todos los meses, aunque sea un mes flojo."
        }),
        Object.freeze({
          icon: "construct-outline",
          title: "Destino claro",
          body: "Un uso concreto de los fondos, con porcentajes."
        })
      ])
    })
  ]),
  finalCta: Object.freeze({
    title: "Registrá tu PyME en la demo",
    body: "KYC simulado, carga de ventas sintéticas y envío para revisión, en unos minutos.",
    cta: Object.freeze({ label: "Comenzar registro", href: "/company" })
  })
});
