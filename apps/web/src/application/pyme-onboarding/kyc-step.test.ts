import { describe, expect, it } from "vitest";
import type { KycResult } from "@/application/ports/kyc-port";
import {
  KYC_ASIDE_PARAGRAPH_2,
  KYC_DOCUMENT_OPTIONS,
  KYC_PROVIDER_LABEL,
  KYC_SECONDARY_LABELS,
  KYC_PRIMARY_LABELS,
  KYC_STEP_COPY,
  WIZARD_STEPS,
  kycPrimaryAction,
  kycPrimaryIcon,
  kycPrimaryLabel,
  kycResultCopy,
  kycSecondaryAction,
  kycSecondaryLabel,
  wizardStepStates,
  type KycPhase
} from "./kyc-step";

const APPROVED: KycResult = { outcome: "approved", reference: "kyc:PH-2026-0001", provider: KYC_PROVIDER_LABEL };
const CHANGES: KycResult = { outcome: "requires_changes", reference: "kyc:PH-2026-0002", provider: KYC_PROVIDER_LABEL };

describe("WIZARD_STEPS", () => {
  it("is the template's four steps, in order and verbatim", () => {
    expect(WIZARD_STEPS.map((step) => step.label)).toEqual(["KYC", "Registro PyME", "Evaluación AI", "Revisión humana"]);
  });
});

describe("wizardStepStates", () => {
  it("marks the first step current and nothing done at the start", () => {
    expect(wizardStepStates(0)).toEqual([
      { id: "kyc", label: "KYC", n: 1, done: false, current: true },
      { id: "registration", label: "Registro PyME", n: 2, done: false, current: false },
      { id: "ai", label: "Evaluación AI", n: 3, done: false, current: false },
      { id: "review", label: "Revisión humana", n: 4, done: false, current: false }
    ]);
  });

  it("marks earlier steps done and the current one current after advancing", () => {
    const states = wizardStepStates(2);
    expect(states.map(({ n, done, current }) => ({ n, done, current }))).toEqual([
      { n: 1, done: true, current: false },
      { n: 2, done: true, current: false },
      { n: 3, done: false, current: true },
      { n: 4, done: false, current: false }
    ]);
  });
});

describe("KYC_DOCUMENT_OPTIONS", () => {
  it("offers the two synthetic identities of the template", () => {
    expect(KYC_DOCUMENT_OPTIONS).toEqual([
      { value: "person_a", label: "DNI sintético · Persona A (responsable)" },
      { value: "person_b", label: "DNI sintético · Persona B (socia)" }
    ]);
  });
});

describe("KYC_STEP_COPY", () => {
  it("quotes the template's step-1 copy verbatim", () => {
    expect(KYC_STEP_COPY).toMatchObject({
      heading: "Verificación de identidad",
      subtitle:
        "KYC/KYB de la persona responsable y de la empresa. En esta demo el resultado es simulado y no se procesa ningún documento real.",
      documentLabel: "Documento",
      dropzoneTitle: "Elegí un documento de prueba",
      dropzoneBody: "Usamos identidades sintéticas para que la demo nunca pida datos personales reales.",
      busyTitle: "Verificando con el adaptador simulado…",
      approvedTitle: "KYC aprobado · SIMULADO",
      approvedBody: "Identidad y empresa verificadas por el adaptador simulado.",
      changesTitle: "Requiere cambios · SIMULADO",
      changesBody:
        "El documento de prueba no coincide con la razón social. Elegí otro documento y volvé a intentar.",
      referenceLabel: "Referencia",
      providerLabel: "Proveedor",
      asideTitle: "¿POR QUÉ KYC?",
      asideParagraph1:
        "En un producto real, conocer a la persona y a la empresa previene fraude y lavado de dinero antes de publicar una campaña."
    });
  });

  it("keeps the aside's emphasised SIMULADO marker as its own part", () => {
    expect(`${KYC_ASIDE_PARAGRAPH_2.lead}${KYC_ASIDE_PARAGRAPH_2.emphasis}${KYC_ASIDE_PARAGRAPH_2.tail}`).toBe(
      "En esta demo el paso existe para mostrar el flujo: el resultado queda marcado como SIMULADO en cada pantalla donde aparece."
    );
  });
});

describe("button labels", () => {
  it.each([
    ["idle", KYC_PRIMARY_LABELS.idle],
    ["busy", KYC_PRIMARY_LABELS.busy]
  ] as const)("primary is %s for phase %s", (phase, label) => {
    expect(kycPrimaryLabel(phase, null)).toBe(label);
  });

  it("primary follows the outcome once done", () => {
    expect(kycPrimaryLabel("done", "approved")).toBe("Siguiente paso");
    expect(kycPrimaryLabel("done", "requires_changes")).toBe("Volver a intentar");
  });

  it("secondary says 'Usar archivo de prueba' only while idle", () => {
    expect(kycSecondaryLabel("idle")).toBe(KYC_SECONDARY_LABELS.idle);
    expect(kycSecondaryLabel("busy")).toBe(KYC_SECONDARY_LABELS.other);
    expect(kycSecondaryLabel("done")).toBe(KYC_SECONDARY_LABELS.other);
  });
});

describe("button actions", () => {
  it.each([
    ["idle", null, "verify"],
    ["done", "approved", "next"],
    ["done", "requires_changes", "retry"]
  ] as const)("primary action for %s/%s is %s", (phase, outcome, action) => {
    expect(kycPrimaryAction(phase, outcome)).toBe(action);
  });

  it("secondary verifies while idle and chooses another document otherwise", () => {
    expect(kycSecondaryAction("idle")).toBe("verify");
    expect(kycSecondaryAction("busy")).toBe("choose-another");
    expect(kycSecondaryAction("done")).toBe("choose-another");
  });

  it("maps the primary icon as the template does (scan / arrow / refresh)", () => {
    expect(kycPrimaryIcon("idle", null)).toBe("scan");
    expect(kycPrimaryIcon("done", "approved")).toBe("arrow-forward");
    expect(kycPrimaryIcon("busy", null)).toBe("refresh");
    expect(kycPrimaryIcon("done", "requires_changes")).toBe("refresh");
  });
});

describe("kycResultCopy", () => {
  it.each([
    [APPROVED, { title: KYC_STEP_COPY.approvedTitle, body: KYC_STEP_COPY.approvedBody, tone: "approved" }],
    [CHANGES, { title: KYC_STEP_COPY.changesTitle, body: KYC_STEP_COPY.changesBody, tone: "changes" }]
  ] as const)("renders the outcome copy for $outcome", (result, expected) => {
    expect(kycResultCopy("done", result)).toEqual(expected);
  });

  it("renders nothing before the verification is done", () => {
    (["idle", "busy"] as readonly KycPhase[]).forEach((phase) => {
      expect(kycResultCopy(phase, null)).toBeNull();
      expect(kycResultCopy(phase, APPROVED)).toBeNull();
    });
  });
});
