import type { Guide } from "./types";

/**
 * «Guía de inversión» (`/investor-guide`), Feature #394 / WU1.
 *
 * Verbatim from `docs/design/template/Vaqcrow Guia de inversion.dc.html`:
 * hero `:105-112`, TOC `:114-123`, sections `:124-130`, final CTA `:131-134`.
 * The login gate (`:91-102`) is not modelled — the owner made the guides
 * public. The «cómo funciona la bóveda» body intentionally mirrors the opening
 * of the canonical contract-custody disclosure (the template reuses it); the
 * full canonical text is not duplicated here.
 */
export const INVESTOR_GUIDE: Guide = Object.freeze({
  eyebrow: "Contenido educativo",
  eyebrowIcon: "school-outline",
  titleLead: "Guía de ",
  titleAccent: "inversión",
  subtitle:
    "Cómo evaluar una PyME sintética antes de aportar: qué es el revenue share, qué se puede perder y cómo leer el riesgo, la evidencia y el cálculo.",
  note: "Esta guía es educativa. No es una recomendación de inversión ni asesoramiento financiero o legal.",
  ctas: Object.freeze([]),
  toc: Object.freeze([
    Object.freeze({ id: "revenue", label: "Revenue share" }),
    Object.freeze({ id: "perder", label: "Qué se puede perder" }),
    Object.freeze({ id: "riesgo", label: "Riesgo" }),
    Object.freeze({ id: "evidencia", label: "Evidencia" }),
    Object.freeze({ id: "boveda", label: "La bóveda" }),
    Object.freeze({ id: "calculo", label: "El cálculo" }),
    Object.freeze({ id: "glosario", label: "Glosario" })
  ]),
  sections: Object.freeze([
    Object.freeze({
      id: "revenue",
      headingId: "revenue-t",
      index: "01",
      title: "Qué es el revenue share",
      body: "Una PyME formal recibe capital y lo devuelve con una participación contractual en sus ingresos: un porcentaje de sus ventas mensuales declaradas, no una cuota fija ni un interés. Si vende más, distribuye más; si vende menos, distribuye menos.",
      cards: Object.freeze([
        Object.freeze({
          icon: "receipt-outline",
          title: "Porcentaje sobre ventas",
          body: "Cada campaña fija su porcentaje (por ejemplo, 4,5 %) y una regla versionada para calcularlo."
        }),
        Object.freeze({
          icon: "calendar-outline",
          title: "Distribución por período",
          body: "El cálculo se hace por mes, sobre ventas declaradas. En la demo, esas ventas son sintéticas."
        }),
        Object.freeze({
          icon: "trending-down-outline",
          title: "Sin retorno garantizado",
          body: "Nada asegura que la PyME venda lo suficiente para devolver el capital aportado."
        })
      ])
    }),
    Object.freeze({
      id: "perder",
      headingId: "perder-t",
      index: "02",
      title: "Qué se puede perder",
      body: "Todo aporte está sujeto a riesgo. Antes de aportar, asumí que podés no recuperar parte o la totalidad del capital.",
      items: Object.freeze([
        "Las ventas de la PyME pueden caer y reducir o frenar las distribuciones.",
        "Una vez liquidado a la PyME, un pago no se puede revertir: no hay clawback.",
        "Si la campaña vence sin meta, el reembolso no se dispara solo: alguien tiene que enviar la transacción.",
        "Los fondos que nadie reclame pueden quedarse en el contrato hasta el barrido."
      ])
    }),
    Object.freeze({
      id: "riesgo",
      headingId: "riesgo-t",
      index: "03",
      title: "Cómo leer el riesgo",
      body: "El riesgo se muestra como una banda textual con ícono, más una confianza numérica de la evaluación. Nunca como un medidor decorativo.",
      bands: Object.freeze([
        Object.freeze({ icon: "shield-outline", tone: "info" as const, label: "Riesgo bajo" }),
        Object.freeze({ icon: "alert-outline", tone: "warn" as const, label: "Riesgo medio" }),
        Object.freeze({ icon: "warning-outline", tone: "error" as const, label: "Riesgo alto" })
      ]),
      callout: Object.freeze({
        lead: "",
        strong: "La IA recomienda; una persona decide.",
        tail: " La banda la propone la IA a partir de la evidencia; la aprobación la registra una persona, con nombre, razón y fecha."
      })
    }),
    Object.freeze({
      id: "evidencia",
      headingId: "evidencia-t",
      index: "04",
      title: "Cómo leer la evidencia",
      body: "Cada dato declara su origen en el punto de decisión. Estos son los estados que vas a encontrar:",
      states: Object.freeze([
        Object.freeze({
          icon: "checkmark-circle-outline",
          label: "",
          title: "Disponible",
          body: "El dato existe y tiene fuente."
        }),
        Object.freeze({
          icon: "remove-circle-outline",
          label: "",
          title: "Faltante",
          body: "Falta el período; nunca se completa con cero."
        }),
        Object.freeze({
          icon: "alert-circle-outline",
          label: "",
          title: "Anómala",
          body: "Se aparta de la tendencia y requiere revisión."
        }),
        Object.freeze({
          icon: "flask-outline",
          label: "",
          title: "SIMULADO",
          body: "Dato sintético de la demo."
        })
      ])
    }),
    Object.freeze({
      id: "boveda",
      headingId: "boveda-t",
      index: "05",
      title: "Cómo funciona la bóveda",
      body: "Durante la campaña, los aportes los custodia el contrato, no una persona: nadie tiene una clave para moverlos. El contrato sólo puede pagar al destino fijo definido al abrir la bóveda, y ese destino es inmutable.",
      states: Object.freeze([
        Object.freeze({
          icon: "lock-open-outline",
          label: "Estado 1",
          title: "Fondeo abierto",
          body: "Podés aportar o retirar tu aporte hasta el cierre."
        }),
        Object.freeze({
          icon: "checkmark-circle-outline",
          label: "Estado 2",
          title: "Meta alcanzada",
          body: "El contrato liquida a la PyME en la misma transacción."
        }),
        Object.freeze({
          icon: "return-down-back-outline",
          label: "Estado 3",
          title: "Reembolso disponible",
          body: "Si vence sin meta, cualquiera puede enviar el reembolso."
        })
      ])
    }),
    Object.freeze({
      id: "calculo",
      headingId: "calculo-t",
      index: "06",
      title: "Cómo se calcula la distribución",
      body: "El cálculo es auditable: entradas, regla versionada, redondeo y resultado. La IA no participa.",
      workedExample: Object.freeze({
        salesLabel: "Ventas declaradas de agosto",
        salesTag: "SIMULADO",
        salesValue: "ARS 3.745.800,00",
        ruleLabel: "Participación (regla RS-2026-01)",
        ruleValue: "× 4,5 %",
        roundingLabel: "Redondeo",
        roundingValue: "2 decimales, al par",
        resultLabel: "Distribución calculada",
        resultValue: "ARS 168.561,00",
        footnote: "Cálculo determinístico; la IA no calcula esta obligación"
      })
    }),
    Object.freeze({
      id: "glosario",
      headingId: "glosario-t",
      index: "07",
      title: "Glosario",
      terms: Object.freeze([
        Object.freeze({
          term: "Revenue share",
          definition: "Participación contractual en los ingresos de la PyME."
        }),
        Object.freeze({
          term: "Bóveda",
          definition: "Contrato de Stellar (Soroban) que custodia los aportes de una campaña."
        }),
        Object.freeze({
          term: "Freighter",
          definition: "Wallet no custodial con la que firmás cada transacción."
        }),
        Object.freeze({
          term: "Testnet",
          definition: "Red de prueba de Stellar; sus activos no tienen valor económico."
        }),
        Object.freeze({
          term: "Hash",
          definition: "Identificador de una transacción, verificable en el explorador."
        }),
        Object.freeze({
          term: "Clawback",
          definition: "Reversión de un pago. En Vaqcrow no existe."
        })
      ])
    })
  ]),
  finalCta: Object.freeze({
    title: "Aplicá lo que leíste",
    body: "Revisá la evidencia y el riesgo de una campaña sintética antes de aportar con activos de prueba.",
    cta: Object.freeze({ label: "Explorar PyMEs", href: "/explore" })
  })
});
