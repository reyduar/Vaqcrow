import { describe, expect, it } from "vitest";
import type { AdminReviewDocument } from "@/application/ports/admin-review-port";
import {
  KYC_VERDICT_OPTIONS,
  kycEditable,
  kycRowsFor,
  kycVerdictFailureMessage,
  KYC_COPY
} from "./kyc";

function doc(documentId: string, kind: string, name: string, contentType = "application/pdf"): AdminReviewDocument {
  return {
    documentId,
    kind,
    objectPath: `owner/${kind}/${documentId}-${name}`,
    name,
    sizeBytes: 1024,
    contentType,
    createdAt: "2026-09-11T12:00:00.000Z"
  };
}

const SALES = doc("d-sales", "sales-declarations", "ventas-2026.pdf");
const CUIT = doc("d-cuit", "cuit", "constancia.pdf");
const ARTICLES = doc("d-articles", "articles-of-incorporation", "estatuto.pdf");
const PHOTO_A = doc("d-photo-a", "photo", "local.jpg", "image/jpeg");
const PHOTO_B = doc("d-photo-b", "photo", "vidriera.png", "image/png");

describe("kycRowsFor", () => {
  it("orders the rows as the template does, titles them from the template and subtitles them with the file name", () => {
    const rows = kycRowsFor([PHOTO_A, SALES, ARTICLES, CUIT, PHOTO_B], []);

    expect(rows.map((row) => [row.title, row.subtitle, row.icon])).toEqual([
      ["Constancia de CUIT", "constancia.pdf", "business"],
      ["Contrato social", "estatuto.pdf", "document"],
      ["Declaraciones de ventas", "ventas-2026.pdf", "chart"],
      ["Foto 1", "local.jpg", "image"],
      ["Foto 2", "vidriera.png", "image"]
    ]);
    expect(rows[0]!.groupLabel).toBe("Estado de Constancia de CUIT");
    expect(rows[0]!.objectPath).toBe(CUIT.objectPath);
    expect(rows[3]!.contentType).toBe("image/jpeg");
  });

  it("never invents a row for a missing document or the simulated identity check", () => {
    const rows = kycRowsFor([CUIT], []);
    expect(rows.map((row) => row.title)).toEqual(["Constancia de CUIT"]);
  });

  it("labels an unknown kind neutrally and keeps it after the known ones", () => {
    const rows = kycRowsFor([doc("d-x", "mystery", "x.pdf"), CUIT], []);
    expect(rows.map((row) => row.title)).toEqual(["Constancia de CUIT", "Documento"]);
  });

  it("attaches the persisted verdict and leaves the others without one", () => {
    const rows = kycRowsFor(
      [CUIT, SALES],
      [{ documentId: "d-sales", verdict: "request", actor: "Admin Vaqcrow", updatedAt: "2026-10-07T12:00:00.000Z" }]
    );
    expect(rows.map((row) => row.verdict)).toEqual([null, "request"]);
  });
});

describe("KYC_VERDICT_OPTIONS", () => {
  it("maps the template labels to the API values", () => {
    expect(KYC_VERDICT_OPTIONS.map((option) => [option.label, option.value])).toEqual([
      ["Válido", "valid"],
      ["Pedir", "request"],
      ["Inválido", "invalid"]
    ]);
  });
});

describe("kycEditable", () => {
  it.each([
    ["awaiting_assessment", true],
    ["human_review", true],
    ["draft", false],
    ["approved", false],
    ["changes_requested", false],
    ["rejected", false]
  ] as const)("%s → %s", (state, editable) => {
    expect(kycEditable(state)).toBe(editable);
  });
});

describe("kycVerdictFailureMessage", () => {
  it("says honestly that a decided review no longer takes verdicts", () => {
    expect(kycVerdictFailureMessage({ ok: false, code: "state_conflict", actualState: "approved" })).toBe(KYC_COPY.alreadyDecided);
    expect(kycVerdictFailureMessage({ ok: false, code: "state_conflict", actualState: "draft" })).toBe(KYC_COPY.notEditable);
  });

  it("keeps the other failures neutral", () => {
    expect(kycVerdictFailureMessage({ ok: false, code: "not_found" })).toBe(KYC_COPY.documentNotFound);
    expect(kycVerdictFailureMessage({ ok: false, code: "unavailable" })).toBe(KYC_COPY.saveFailed);
    expect(kycVerdictFailureMessage({ ok: false, code: "network" })).toBe(KYC_COPY.saveFailed);
  });
});
