import { describe, expect, it } from "vitest";
import {
  emptyDocumentSlotState,
  type DocumentsState,
  type DocumentSlotState,
  type PhotoState
} from "@/application/pyme-onboarding/document-upload";
import { DEMO_VALUES, SALES_MONTHS } from "@/application/pyme-onboarding/registration-step";
import {
  COMPLETENESS_COPY,
  buildCompletenessInput,
  completenessErrorMessage,
  completenessNotice,
  findingLabel,
  salesValueArs
} from "./completeness";

function slot(present: boolean): DocumentSlotState {
  return present
    ? {
        phase: "uploaded",
        progress: 100,
        document: { path: `documents/${Math.random()}`, name: "doc.pdf", size: 4, contentType: "application/pdf" },
        error: null,
        errorKind: null,
        pendingFileName: null
      }
    : emptyDocumentSlotState();
}

function documentsState(sales: boolean, cuit: boolean, articles: boolean): DocumentsState {
  return {
    "sales-declarations": slot(sales),
    cuit: slot(cuit),
    "articles-of-incorporation": slot(articles)
  };
}

function photo(uploaded: boolean, index: number): PhotoState {
  return {
    id: `photo-${index}`,
    phase: uploaded ? "uploaded" : "uploading",
    progress: uploaded ? 100 : 0,
    document: uploaded
      ? { path: `photos/${index}`, name: `${index}.png`, size: 4, contentType: "image/png" }
      : null,
    error: null,
    errorKind: null,
    previewUrl: null,
    pendingFileName: null
  };
}

describe("COMPLETENESS_COPY", () => {
  it("uses the owner-approved title and error copy, with no simulated marker", () => {
    expect(COMPLETENESS_COPY.title).toBe("Información completa");
    expect(COMPLETENESS_COPY.errorMessage).toBe("No pudimos revisar la información. Podés continuar igual.");
    expect(Object.keys(COMPLETENESS_COPY)).not.toContain("simulado");
  });

  it("gives an invalid session its own honest message, distinct from an unavailable service", () => {
    expect(completenessErrorMessage("unauthorized")).toBe(
      "Tu sesión no es válida o venció. Volvé a iniciar sesión."
    );
    expect(completenessErrorMessage("unavailable")).toBe(COMPLETENESS_COPY.errorMessage);
    expect(completenessErrorMessage("network")).toBe(COMPLETENESS_COPY.errorMessage);
    expect(completenessErrorMessage("invalid_request")).toBe(COMPLETENESS_COPY.errorMessage);
  });
});

describe("buildCompletenessInput", () => {
  it("reports every mandatory document slot with its presence", () => {
    const input = buildCompletenessInput(["", "", "", "", "", "", "", ""], documentsState(true, true, false), []);

    expect(input.documents).toEqual([
      { kind: "sales-declarations", present: true },
      { kind: "cuit", present: true },
      { kind: "articles-of-incorporation", present: false }
    ]);
  });

  it("counts only uploaded photos", () => {
    const input = buildCompletenessInput(
      ["", "", "", "", "", "", "", ""],
      documentsState(true, true, true),
      [photo(true, 1), photo(false, 2), photo(true, 3)]
    );

    expect(input.photoCount).toBe(2);
  });

  it("maps the eight sales months with their ARS value, empty as null", () => {
    const input = buildCompletenessInput(DEMO_VALUES.sales, documentsState(true, true, true), []);

    expect(input.salesMonths.map((month) => month.month)).toEqual([...SALES_MONTHS]);
    expect(input.salesMonths).toHaveLength(8);
    expect(input.salesMonths[0]).toEqual({ month: "Enero", valueArs: 3150000 });
    expect(input.salesMonths[3]).toEqual({ month: "Abril", valueArs: null });
  });
});

describe("salesValueArs", () => {
  it("parses the template's amount format and maps empty or non-numeric to null", () => {
    expect(salesValueArs("")).toBeNull();
    expect(salesValueArs("3.150.000")).toBe(3150000);
    expect(salesValueArs("4,5")).toBe(4.5);
    expect(salesValueArs("sin dato")).toBeNull();
  });
});

describe("findingLabel", () => {
  it("names each finding in visible text, so colour is never the only signal", () => {
    expect(findingLabel({ code: "missing_document", severity: "gap" })).toBe("Faltante");
    expect(findingLabel({ code: "missing_sales_month", severity: "gap" })).toBe("Faltante");
    expect(findingLabel({ code: "insufficient_photos", severity: "warning" })).toBe("Aviso");
    expect(findingLabel({ code: "sales_anomaly", severity: "warning" })).toBe("Anomalía");
  });

  it("names the content-relevance findings visibly: a gap is a Faltante, a warning an Aviso", () => {
    expect(findingLabel({ code: "content_irrelevant", severity: "gap" })).toBe("Faltante");
    expect(findingLabel({ code: "content_unverified", severity: "warning" })).toBe("Aviso");
  });
});

describe("completenessNotice", () => {
  it("warns when incomplete, confirms when complete, and stays quiet otherwise", () => {
    expect(completenessNotice({ complete: false, findings: [gapFinding()] })).toBe(
      COMPLETENESS_COPY.incompleteNotice
    );
    expect(completenessNotice({ complete: true, findings: [] })).toBe(COMPLETENESS_COPY.emptyNotice);
    expect(
      completenessNotice({
        complete: true,
        findings: [{ code: "sales_anomaly", severity: "warning", detail: "x" }]
      })
    ).toBeNull();
  });
});

function gapFinding() {
  return { code: "missing_document" as const, severity: "gap" as const, detail: "Falta Estatuto." };
}
