/**
 * Pure model of the PyME onboarding wizard's step 2 («Registrá tu PyME»),
 * React-free so the copy, the amount parsing and the validation rules are
 * unit-tested without rendering. No persistence lives here (that is T3):
 * the component only validates and hands the raw strings to `onSubmit`.
 *
 * Copy is verbatim from the owner's template
 * `docs/design/template/Vaqcrow Onboarding PyME.dc.html` (export 2026-10-03):
 * lines 158–197 (step 2), the validation rules on lines 315–336 and the
 * `fillDemo` values on line 350. The template's own amount parser (`num`,
 * line 318) is the contract for `parseAmount`.
 *
 * The «Declaraciones de ventas» attach control of the template (lines 190–192)
 * is deliberately absent: real document/photo upload is T4 and its UI is an
 * owner decision still pending (recorded in
 * `odd/tasks/pyme-onboarding-wizard-and-document-upload.md`).
 */

export type RegistrationField = "name" | "cuit" | "sector" | "city" | "desc" | "sales" | "goal" | "rs";

/** All scalar fields except the sales group. */
export type RegistrationScalarField = Exclude<RegistrationField, "sales">;

export interface RegistrationValues {
  readonly name: string;
  readonly cuit: string;
  readonly sector: string;
  readonly city: string;
  readonly desc: string;
  readonly sales: readonly string[];
  readonly goal: string;
  readonly rs: string;
}

export interface RegistrationError {
  readonly field: RegistrationField;
  readonly message: string;
}

/** Template line 172: the six rubros, in order and verbatim. */
export const SECTOR_OPTIONS: readonly string[] = Object.freeze([
  "Alimentos",
  "Gastronomía",
  "Servicio automotor",
  "Comercio minorista",
  "Salud y deporte",
  "Autopartes"
]);

/** Template line 333: `['Enero', … 'Agosto']`. */
export const SALES_MONTHS: readonly string[] = Object.freeze([
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto"
]);

export const REGISTRATION_COPY = Object.freeze({
  heading: "Registrá tu PyME",
  subtitle:
    "Contanos qué hace tu empresa y cargá la evidencia de ventas. Con esto la IA arma una evaluación consultiva y una persona decide si la campaña se publica.",
  aiCalloutLead: "La IA recomienda; una persona decide.",
  aiCalloutTail: " Enviar no aprueba la campaña ni abre la bóveda.",
  demoCallout: "Demo: usá datos sintéticos. No cargues información real de tu empresa.",
  formTitle: "Datos de la empresa",
  fillDemo: "Completar con datos de ejemplo",
  errorSummaryTail: "Están marcados abajo.",
  salesLegend: "Ventas mensuales 2026 (ARS)",
  salesHint: "Dejá vacío un mes sin declaración: se marca como faltante, nunca como cero.",
  simulado: "SIMULADO",
  missing: "Faltante",
  anomaly: "Anomalía",
  submit: "Enviar a evaluación AI",
  submitting: "Enviando…",
  bottomNote: "Enviar no publica la campaña. Primero pasa por la evaluación de IA y la decisión de una persona.",
  fields: Object.freeze({
    name: Object.freeze({ label: "Razón social", placeholder: "Ej. Panadería Horizonte SRL" }),
    cuit: Object.freeze({ label: "CUIT", placeholder: "30-00000000-0", hint: "11 dígitos" }),
    sector: Object.freeze({ label: "Rubro", placeholder: "Elegí un rubro" }),
    city: Object.freeze({ label: "Ciudad", placeholder: "Ej. Córdoba" }),
    desc: Object.freeze({
      label: "Breve descripción del negocio",
      placeholder: "Qué vendés, a quién y para qué necesitás el financiamiento"
    }),
    goal: Object.freeze({ label: "Meta de financiamiento (ARS)", placeholder: "15.000.000" }),
    rs: Object.freeze({
      label: "Revenue share propuesto (%)",
      placeholder: "4,5",
      hint: "Entre 1 % y 10 % de las ventas mensuales"
    })
  })
});

/** Template lines 321–328: the exact validation messages, field by field. */
export const REGISTRATION_ERRORS: Readonly<Record<RegistrationField, string>> = Object.freeze({
  name: "Ingresá la razón social.",
  cuit: "El CUIT debe tener 11 dígitos.",
  sector: "Elegí un rubro.",
  city: "Ingresá la ciudad.",
  desc: "Contanos un poco más: al menos 20 caracteres.",
  sales: "Cargá al menos 6 de los 8 meses.",
  goal: "La meta mínima es ARS 1.000.000.",
  rs: "Debe estar entre 1 % y 10 %."
});

const EMPTY_SALES: readonly string[] = Object.freeze(["", "", "", "", "", "", "", ""]);

export const EMPTY_REGISTRATION_VALUES: RegistrationValues = Object.freeze({
  name: "",
  cuit: "",
  sector: "",
  city: "",
  desc: "",
  sales: EMPTY_SALES,
  goal: "",
  rs: ""
});

/** Template line 350: the `fillDemo` values verbatim, month 4 left empty. */
export const DEMO_VALUES: RegistrationValues = Object.freeze({
  name: "Panadería Horizonte SRL",
  cuit: "30-71234567-8",
  sector: "Alimentos",
  city: "Córdoba",
  desc: "Pan de masa madre y facturas para barrio y 22 cafeterías. Buscamos un horno rotativo y un segundo local.",
  goal: "15.000.000",
  rs: "4,5",
  sales: Object.freeze(["3.150.000", "3.320.500", "3.410.750", "", "3.580.900", "6.240.000", "3.690.300", "3.745.800"])
});

/** Template line 317: `digits = v => String(v).replace(/\D/g, '')`. */
export function cuitDigits(raw: string): string {
  return String(raw).replace(/\D/g, "");
}

/**
 * Template line 318: `num = v => +String(v).replace(/\./g, '').replace(',', '.')`.
 * An empty string parses to `0` and non-numeric text to `NaN`, exactly like the
 * template's unary plus.
 */
export function parseAmount(raw: string): number {
  return Number(String(raw).replace(/\./g, "").replace(",", "."));
}

/** Template lines 319–329, in the template's field order. */
export function validateRegistration(values: RegistrationValues): RegistrationError[] {
  const errors: RegistrationError[] = [];
  if (!values.name.trim()) errors.push({ field: "name", message: REGISTRATION_ERRORS.name });
  if (cuitDigits(values.cuit).length !== 11) errors.push({ field: "cuit", message: REGISTRATION_ERRORS.cuit });
  if (!values.sector) errors.push({ field: "sector", message: REGISTRATION_ERRORS.sector });
  if (!values.city.trim()) errors.push({ field: "city", message: REGISTRATION_ERRORS.city });
  if (values.desc.trim().length < 20) errors.push({ field: "desc", message: REGISTRATION_ERRORS.desc });
  if (values.sales.filter((value) => value !== "").length < 6) {
    errors.push({ field: "sales", message: REGISTRATION_ERRORS.sales });
  }
  if (!(parseAmount(values.goal) >= 1000000)) errors.push({ field: "goal", message: REGISTRATION_ERRORS.goal });
  const revenueShare = parseAmount(values.rs);
  if (!(revenueShare >= 1 && revenueShare <= 10)) errors.push({ field: "rs", message: REGISTRATION_ERRORS.rs });
  return errors;
}

export function registrationValid(values: RegistrationValues): boolean {
  return validateRegistration(values).length === 0;
}

/** Template line 326's `< 6` count, exposed for the component's summary. */
export function registrationErrorSummary(count: number): string {
  return `Revisá ${count} campos.`;
}

/** Template line 335: `'Ventas de ' + label.toLowerCase() + ' en ARS'`. */
export function salesMonthAria(month: string): string {
  return `Ventas de ${month.toLowerCase()} en ARS`;
}

/**
 * Template lines 334–335: a month is anomalous when it is non-empty and its
 * parsed value is more than 1.5× the average of the *positive* parsed months.
 * An empty month is never an anomaly — it is a faltante (`salesMissing`).
 *
 * Retained (Feature #402 / T1c) only for this step's inline field indicator:
 * the authoritative anomaly finding the PyME sees in step 3 now comes from the
 * API's `POST /completeness-check` (which mirrors the same 1.5× rule), so the
 * step-3 display never re-derives it here.
 */
export function salesAnomaly(sales: readonly string[]): boolean[] {
  const positives = sales.map(parseAmount).filter((value) => value > 0);
  const average = positives.length ? positives.reduce((sum, value) => sum + value, 0) / positives.length : 0;
  return sales.map((raw) => {
    if (raw === "" || average <= 0) return false;
    return parseAmount(raw) > average * 1.5;
  });
}

/** Template line 335: `miss = v === ''`; an empty month is a faltante, never `0`. */
export function salesMissing(sales: readonly string[]): boolean[] {
  return sales.map((raw) => raw === "");
}
