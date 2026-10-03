import { describe, expect, it } from "vitest";
import {
  DEMO_VALUES,
  EMPTY_REGISTRATION_VALUES,
  REGISTRATION_COPY,
  REGISTRATION_ERRORS,
  SALES_MONTHS,
  SECTOR_OPTIONS,
  parseAmount,
  registrationErrorSummary,
  registrationValid,
  salesAnomaly,
  salesMissing,
  salesMonthAria,
  validateRegistration,
  type RegistrationValues
} from "./registration-step";

const VALID: RegistrationValues = {
  name: "Panadería Horizonte SRL",
  cuit: "30-71234567-8",
  sector: "Alimentos",
  city: "Córdoba",
  desc: "Pan de masa madre y facturas para barrio y 22 cafeterías. Buscamos un horno rotativo y un segundo local.",
  goal: "15.000.000",
  rs: "4,5",
  sales: ["3.150.000", "3.320.500", "3.410.750", "", "3.580.900", "6.240.000", "3.690.300", "3.745.800"]
};

function withValues(patch: Partial<RegistrationValues>): RegistrationValues {
  return { ...VALID, ...patch };
}

describe("REGISTRATION_COPY", () => {
  it("quotes the template's step-2 copy verbatim", () => {
    expect(REGISTRATION_COPY.heading).toBe("Registrá tu PyME");
    expect(REGISTRATION_COPY.subtitle).toBe(
      "Contanos qué hace tu empresa y cargá la evidencia de ventas. Con esto la IA arma una evaluación consultiva y una persona decide si la campaña se publica."
    );
    expect(REGISTRATION_COPY.aiCalloutLead).toBe("La IA recomienda; una persona decide.");
    expect(REGISTRATION_COPY.aiCalloutTail).toBe(" Enviar no aprueba la campaña ni abre la bóveda.");
    expect(REGISTRATION_COPY.demoCallout).toBe(
      "Demo: usá datos sintéticos. No cargues información real de tu empresa."
    );
    expect(REGISTRATION_COPY.formTitle).toBe("Datos de la empresa");
    expect(REGISTRATION_COPY.fillDemo).toBe("Completar con datos de ejemplo");
    expect(REGISTRATION_COPY.salesLegend).toBe("Ventas mensuales 2026 (ARS)");
    expect(REGISTRATION_COPY.salesHint).toBe(
      "Dejá vacío un mes sin declaración: se marca como faltante, nunca como cero."
    );
    expect(REGISTRATION_COPY.simulado).toBe("SIMULADO");
    expect(REGISTRATION_COPY.submit).toBe("Enviar a evaluación AI");
    expect(REGISTRATION_COPY.submitting).toBe("Enviando…");
    expect(REGISTRATION_COPY.bottomNote).toBe(
      "Enviar no publica la campaña. Primero pasa por la evaluación de IA y la decisión de una persona."
    );
    expect(REGISTRATION_COPY.errorSummaryTail).toBe("Están marcados abajo.");
    expect(REGISTRATION_COPY.missing).toBe("Faltante");
    expect(REGISTRATION_COPY.anomaly).toBe("Anomalía");
  });

  it("quotes the field labels, placeholders and hints verbatim", () => {
    expect(REGISTRATION_COPY.fields).toEqual({
      name: { label: "Razón social", placeholder: "Ej. Panadería Horizonte SRL" },
      cuit: { label: "CUIT", placeholder: "30-00000000-0", hint: "11 dígitos" },
      sector: { label: "Rubro", placeholder: "Elegí un rubro" },
      city: { label: "Ciudad", placeholder: "Ej. Córdoba" },
      desc: {
        label: "Breve descripción del negocio",
        placeholder: "Qué vendés, a quién y para qué necesitás el financiamiento"
      },
      goal: { label: "Meta de financiamiento (ARS)", placeholder: "15.000.000" },
      rs: { label: "Revenue share propuesto (%)", placeholder: "4,5", hint: "Entre 1 % y 10 % de las ventas mensuales" }
    });
  });
});

describe("SECTOR_OPTIONS", () => {
  it("is the template's rubro list, in order and verbatim", () => {
    expect(SECTOR_OPTIONS).toEqual([
      "Alimentos",
      "Gastronomía",
      "Servicio automotor",
      "Comercio minorista",
      "Salud y deporte",
      "Autopartes"
    ]);
  });
});

describe("SALES_MONTHS", () => {
  it("is Enero through Agosto", () => {
    expect(SALES_MONTHS).toEqual(["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto"]);
  });
});

describe("REGISTRATION_ERRORS", () => {
  it("is the template's exact validation copy", () => {
    expect(REGISTRATION_ERRORS).toEqual({
      name: "Ingresá la razón social.",
      cuit: "El CUIT debe tener 11 dígitos.",
      sector: "Elegí un rubro.",
      city: "Ingresá la ciudad.",
      desc: "Contanos un poco más: al menos 20 caracteres.",
      sales: "Cargá al menos 6 de los 8 meses.",
      goal: "La meta mínima es ARS 1.000.000.",
      rs: "Debe estar entre 1 % y 10 %."
    });
  });
});

describe("DEMO_VALUES", () => {
  it("copies the template's fillDemo values verbatim, with the empty 4th month", () => {
    expect(DEMO_VALUES).toEqual({
      name: "Panadería Horizonte SRL",
      cuit: "30-71234567-8",
      sector: "Alimentos",
      city: "Córdoba",
      desc: "Pan de masa madre y facturas para barrio y 22 cafeterías. Buscamos un horno rotativo y un segundo local.",
      goal: "15.000.000",
      rs: "4,5",
      sales: ["3.150.000", "3.320.500", "3.410.750", "", "3.580.900", "6.240.000", "3.690.300", "3.745.800"]
    });
  });
});

describe("EMPTY_REGISTRATION_VALUES", () => {
  it("has eight empty months and empty text fields", () => {
    expect(EMPTY_REGISTRATION_VALUES).toEqual({
      name: "",
      cuit: "",
      sector: "",
      city: "",
      desc: "",
      goal: "",
      rs: "",
      sales: ["", "", "", "", "", "", "", ""]
    });
  });
});

describe("parseAmount", () => {
  it("strips thousands dots, turns the comma into a decimal point and keeps the sign", () => {
    expect(parseAmount("15.000.000")).toBe(15000000);
    expect(parseAmount("3.150.000")).toBe(3150000);
    expect(parseAmount("4,5")).toBe(4.5);
    expect(parseAmount("4,5")).toBeCloseTo(4.5);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("abc")).toBeNaN();
  });
});

describe("validateRegistration", () => {
  it("returns nothing for a valid set", () => {
    expect(validateRegistration(VALID)).toEqual([]);
    expect(registrationValid(VALID)).toBe(true);
  });

  it.each([
    ["name", { name: "   " }, "Ingresá la razón social."],
    ["cuit", { cuit: "30-7123456-8" }, "El CUIT debe tener 11 dígitos."],
    ["sector", { sector: "" }, "Elegí un rubro."],
    ["city", { city: "  " }, "Ingresá la ciudad."],
    ["desc", { desc: "muy corto" }, "Contanos un poco más: al menos 20 caracteres."],
    [
      "sales",
      { sales: ["1", "2", "3", "", "", "", "", ""] },
      "Cargá al menos 6 de los 8 meses."
    ],
    ["goal", { goal: "999.999" }, "La meta mínima es ARS 1.000.000."],
    ["rs", { rs: "12" }, "Debe estar entre 1 % y 10 %."]
  ] as const)("reports the template message for an invalid %s", (field, patch, message) => {
    const errors = validateRegistration(withValues(patch as Partial<RegistrationValues>));
    expect(errors).toEqual([{ field, message }]);
  });

  it("counts CUIT digits only, so separators never inflate or deflate the length", () => {
    expect(validateRegistration(withValues({ cuit: "30712345678" }))).toEqual([]);
    expect(validateRegistration(withValues({ cuit: "30.712.345.678" }))).toEqual([]);
  });

  it("accepts the inclusive revenue-share bounds and rejects outside", () => {
    expect(registrationValid(withValues({ rs: "1" }))).toBe(true);
    expect(registrationValid(withValues({ rs: "10" }))).toBe(true);
    expect(registrationValid(withValues({ rs: "0,9" }))).toBe(false);
    expect(registrationValid(withValues({ rs: "10,1" }))).toBe(false);
  });

  it("counts six non-empty months as enough", () => {
    expect(registrationValid(withValues({ sales: ["1", "2", "3", "4", "5", "6", "", ""] }))).toBe(true);
  });

  it("keeps the template's field order in the returned errors", () => {
    const invalid = withValues({
      name: "",
      cuit: "",
      sector: "",
      city: "",
      desc: "",
      sales: ["", "", "", "", "", "", "", ""],
      goal: "",
      rs: ""
    });
    expect(validateRegistration(invalid).map((error) => error.field)).toEqual([
      "name",
      "cuit",
      "sector",
      "city",
      "desc",
      "sales",
      "goal",
      "rs"
    ]);
  });
});

describe("salesAnomaly", () => {
  it("flags a month more than 1.5x the average of the positive months", () => {
    expect(salesAnomaly(VALID.sales)).toEqual([false, false, false, false, false, true, false, false]);
  });

  it("never treats an empty month as an anomaly (it is a faltante)", () => {
    expect(salesAnomaly(["", "", "", "", "", "", "", ""])).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false
    ]);
  });

  it("uses only the positive parsed values for the average", () => {
    // positives 1.000 and 2.000 -> avg 1.500; 1.5x = 2.250, so 2.000 is fine.
    expect(salesAnomaly(["1.000", "2.000", "", "", "", "", "", ""])).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false
    ]);
    // positives {1.000, 2.000, 6.000} -> avg 3.000; 1.5x = 4.500, so 6.000 is flagged.
    expect(salesAnomaly(["1.000", "2.000", "6.000", "", "", "", "", ""])[2]).toBe(true);
  });
});

describe("salesMissing", () => {
  it("flags exactly the empty months", () => {
    expect(salesMissing(VALID.sales)).toEqual([false, false, false, true, false, false, false, false]);
  });
});

describe("registrationErrorSummary", () => {
  it("wraps the count in the template's lead sentence", () => {
    expect(registrationErrorSummary(1)).toBe("Revisá 1 campos.");
    expect(registrationErrorSummary(8)).toBe("Revisá 8 campos.");
  });
});

describe("salesMonthAria", () => {
  it("lowercases the month in the template's aria label", () => {
    expect(salesMonthAria("Enero")).toBe("Ventas de enero en ARS");
    expect(salesMonthAria("Agosto")).toBe("Ventas de agosto en ARS");
  });
});
