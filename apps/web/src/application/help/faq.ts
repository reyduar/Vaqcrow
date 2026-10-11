/**
 * «Centro de ayuda» (`/help`) copy, Feature #394 / WU1. React-free so the
 * search UI, the category cards, the FAQ accordion and the contact block share
 * one source; the presentation layer (WU4) renders it.
 *
 * Verbatim from `docs/design/template/Vaqcrow Ayuda.dc.html`: hero `:106-108`,
 * categories and FAQ data `:184-195`, labels and empty state `:118-123`,
 * contact block `:132-134`, upcoming note `:120`. The login gate (`:91-102`)
 * is not modelled — the owner made help public. The RAG assistant is out of
 * scope: only the «Próximamente» note remains.
 */

export type HelpCategoryId = "demo" | "cuenta" | "stellar" | "aportes";

export interface HelpCategory {
  readonly id: HelpCategoryId;
  readonly label: string;
  readonly icon: string;
  readonly description: string;
}

export interface HelpFaq {
  readonly id: string;
  readonly category: HelpCategoryId;
  readonly question: string;
  readonly answer: string;
}

export const HELP_CATEGORIES: readonly HelpCategory[] = Object.freeze([
  Object.freeze({
    id: "demo",
    label: "Cómo funciona",
    icon: "layers-outline",
    description: "Revenue share, evaluación y decisión humana."
  }),
  Object.freeze({
    id: "cuenta",
    label: "Cuenta y wallet",
    icon: "key-outline",
    description: "Sesión de demo, Freighter y firma no custodial."
  }),
  Object.freeze({
    id: "stellar",
    label: "Stellar Testnet",
    icon: "git-network-outline",
    description: "Red de prueba, hashes y confirmaciones."
  }),
  Object.freeze({
    id: "aportes",
    label: "Aportes y reembolsos",
    icon: "cube-outline",
    description: "La bóveda, la meta, retiros y reembolsos."
  })
] as const);

export const HELP_FAQS: readonly HelpFaq[] = Object.freeze([
  Object.freeze({
    id: "que-es-revenue-share",
    category: "demo",
    question: "¿Qué es el revenue share?",
    answer:
      "Es una participación contractual en los ingresos de la PyME: un porcentaje de sus ventas mensuales declaradas. No es una cuota fija ni un interés, y no tiene retorno garantizado."
  }),
  Object.freeze({
    id: "ia-aprueba",
    category: "demo",
    question: "¿La IA aprueba las campañas?",
    answer:
      "No. La IA organiza la evidencia, marca faltantes y anomalías y propone una evaluación explicable. La decisión la registra una persona, con nombre, razón y fecha."
  }),
  Object.freeze({
    id: "datos-reales",
    category: "demo",
    question: "¿Qué datos son reales en la demo?",
    answer:
      "Ninguno de identidad ni de ventas: el KYC/KYB, las ventas y la conversión ARS/activo Stellar son sintéticos. Lo que se ejecuta de verdad son las transacciones en Stellar Testnet."
  }),
  Object.freeze({
    id: "guarda-seed",
    category: "cuenta",
    question: "¿Vaqcrow guarda mis fondos o mi seed?",
    answer:
      "No. Freighter firma cada transacción y vos conservás tus claves; Vaqcrow nunca recibe tu seed. Durante una campaña, los aportes los custodia el contrato de la bóveda, no una persona."
  }),
  Object.freeze({
    id: "conectar-freighter",
    category: "cuenta",
    question: "¿Cómo conecto Freighter?",
    answer:
      "Instalá la extensión de Freighter, creá o importá una cuenta de Testnet y tocá «Conectar Freighter». Antes de firmar, siempre vas a ver red, contrato, activo y monto."
  }),
  Object.freeze({
    id: "que-es-testnet",
    category: "stellar",
    question: "¿Qué es Stellar Testnet?",
    answer:
      "Es la red de prueba de Stellar. Sus activos no tienen valor económico: un hash de Testnet demuestra ejecución técnica, no una inversión real."
  }),
  Object.freeze({
    id: "pendiente-confirmacion",
    category: "stellar",
    question: "¿Por qué mi transacción dice «pendiente de confirmación»?",
    answer:
      "Porque se envió pero el ledger todavía no la confirmó. Enviado no es lo mismo que confirmado: la marcamos como confirmada solo cuando aparece en el ledger."
  }),
  Object.freeze({
    id: "retirar-aporte",
    category: "aportes",
    question: "¿Puedo retirar mi aporte?",
    answer:
      "Sí, mientras el fondeo siga abierto. Una vez que el contrato liquida a la PyME al alcanzar la meta, el pago no se puede revertir."
  }),
  Object.freeze({
    id: "campana-sin-meta",
    category: "aportes",
    question: "¿Qué pasa si la campaña no llega a la meta?",
    answer:
      "Al vencer, se habilita el reembolso. No se dispara solo: alguien tiene que enviar la transacción, y cualquiera puede hacerlo porque el destino ya está fijado."
  })
] as const);

export const HELP_COPY = Object.freeze({
  hero: Object.freeze({
    title: "¿Cómo podemos ayudarte?",
    subtitle:
      "Respuestas sobre la demo, la bóveda, Freighter y Stellar Testnet. No es asesoramiento legal ni financiero."
  }),
  search: Object.freeze({
    /** Visually-hidden label of the search input. */
    label: "Buscar en la ayuda",
    placeholder: "Buscá preguntas o términos, por ejemplo “reembolso”"
  }),
  faqHeadingId: "faq-t",
  faqHeading: "Preguntas frecuentes",
  clearFilter: "Ver todas",
  emptyState: Object.freeze({
    /** «No encontramos resultados para “<query>”» — curly quotes as the template writes them. */
    title: (query: string) => `No encontramos resultados para “${query}”`,
    body: "Probá con otra palabra, como “bóveda”, “Freighter” o “riesgo”, o elegí otra categoría."
  }),
  upcoming:
    "Próximamente: un asistente que responde con la documentación de la demo. Lo vas a encontrar en el botón de ayuda.",
  contact: Object.freeze({
    title: "¿No encontrás lo que buscás?",
    body: "Escribinos y te respondemos. Es una demo académica: no damos soporte sobre dinero real porque no lo hay.",
    email: Object.freeze({ label: "Escribir al equipo", href: "mailto:contact@vaqcrow.com" }),
    guide: Object.freeze({ label: "Leer la guía de inversión", href: "/investor-guide" })
  })
});

/** The FAQs of one category, in template order. */
export function faqsInCategory(category: HelpCategoryId): readonly HelpFaq[] {
  return HELP_FAQS.filter((faq) => faq.category === category);
}

/** Template `:203`: `n === 1 ? '1 pregunta' : n + ' preguntas'`, plus « en <category> ». */
export function helpResultLabel(count: number, categoryLabel?: string): string {
  const base = count === 1 ? "1 pregunta" : `${count} preguntas`;
  return categoryLabel ? `${base} en ${categoryLabel}` : base;
}

/** Template `:204`: the count chip each category card renders. */
export function helpCategoryCount(count: number): string {
  return `${count} preguntas`;
}
