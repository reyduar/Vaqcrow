import { describe, expect, it } from "vitest";
import type { MyDocument, SmeRequestRead } from "@vaqcrow/contracts";
import { AI_RISK_LABELS, AI_STEP_COPY } from "@/application/pyme-onboarding/ai-step";
import type { BusinessRecord } from "@/application/ports/business-port";
import { SUBMITTED_DATA_COPY, submittedDataView, type ReadOutcome, type SubmittedBlock } from "./submitted-data";

const BUSINESS: BusinessRecord = {
  businessId: "b1e6c2a4-9f3d-4a7b-8c1e-5d2f6a9b0c31",
  ownerUserId: "00000000-0000-4000-8000-000000000000",
  name: "Panadería Horizonte",
  cuit: "20123456789",
  sector: "Alimentos",
  city: "Córdoba",
  description: "Panadería de barrio",
  goalArs: 15_000_000,
  revenueShare: 5,
  createdAt: "2026-10-03T12:00:00.000Z",
  updatedAt: "2026-10-03T12:00:00.000Z"
};

const REQUEST_READ: SmeRequestRead = {
  request: {
    smeReference: "sme:SYN-1",
    declaredTotalArs: 9_700_000,
    periodStart: "2026-01",
    periodEnd: "2026-03",
    simuladoLabel: "SIMULADO"
  },
  salesPeriods: [
    { period: "2026-01", amountArs: 3_200_000, status: "reported", evidenceRef: "sales:1", simuladoLabel: "SIMULADO" },
    { period: "2026-02", amountArs: null, status: "missing", evidenceRef: "sales:2", simuladoLabel: "SIMULADO" }
  ],
  state: "human_review"
};

const DOCUMENTS: readonly MyDocument[] = [
  {
    documentId: "11111111-1111-4111-8111-111111111111",
    kind: "cuit",
    name: "constancia-cuit.pdf",
    sizeBytes: 128_512,
    contentType: "application/pdf",
    createdAt: "2026-10-03T12:00:00.000Z"
  },
  {
    documentId: "22222222-2222-4222-8222-222222222222",
    kind: "photo",
    name: "local.jpg",
    sizeBytes: 2048,
    contentType: "image/jpeg",
    createdAt: "2026-10-03T12:00:00.000Z"
  }
];

const ok = <T,>(value: T): ReadOutcome<T> => ({ status: "ok", value });
const loading = <T,>(): ReadOutcome<T> => ({ status: "loading" });
const failed = <T,>(): ReadOutcome<T> => ({ status: "failed" });

function view(reads: Parameters<typeof submittedDataView>[0]): readonly SubmittedBlock[] {
  return submittedDataView(reads);
}

function block(blocks: readonly SubmittedBlock[], key: SubmittedBlock["key"]): SubmittedBlock {
  const found = blocks.find((entry) => entry.key === key);
  if (!found) throw new Error(`missing block ${key}`);
  return found;
}

const ALL_READY = {
  business: ok(BUSINESS),
  request: ok(REQUEST_READ),
  documents: ok(DOCUMENTS)
};

describe("submittedDataView", () => {
  it("orders the blocks company, request, sales, documents", () => {
    expect(view(ALL_READY).map((entry) => entry.key)).toEqual(["company", "request", "sales", "documents"]);
  });

  it("shapes the persisted company into name, sector, city, goal and use of funds", () => {
    const company = block(
      view({ ...ALL_READY, business: ok({ ...BUSINESS, useOfFunds: "Un horno rotativo y capital de trabajo" }) }),
      "company"
    );

    expect(company.state).toBe("ready");
    expect(company.fields).toEqual([
      { label: SUBMITTED_DATA_COPY.fields.name, value: "Panadería Horizonte" },
      { label: SUBMITTED_DATA_COPY.fields.sector, value: "Alimentos" },
      { label: SUBMITTED_DATA_COPY.fields.city, value: "Córdoba" },
      { label: SUBMITTED_DATA_COPY.fields.goal, value: "ARS 15.000.000" },
      { label: "Destino de los fondos", value: "Un horno rotativo y capital de trabajo" }
    ]);
    expect(company.message).toBeNull();
  });

  it("reads Sin dato for a company registered before the use of funds existed (#577)", () => {
    const company = block(view(ALL_READY), "company");

    expect(company.fields.at(-1)).toEqual({ label: "Destino de los fondos", value: "Sin dato" });
  });

  it("shapes the request into reference, total and period", () => {
    const request = block(view(ALL_READY), "request");

    expect(request.fields).toEqual([
      { label: SUBMITTED_DATA_COPY.fields.reference, value: "sme:SYN-1" },
      { label: SUBMITTED_DATA_COPY.fields.total, value: "ARS 9.700.000" },
      { label: SUBMITTED_DATA_COPY.fields.period, value: "Enero 2026 – Marzo 2026" }
    ]);
  });

  it("lists the declared sales months, a missing month reading Sin dato (never a 0)", () => {
    const sales = block(view(ALL_READY), "sales");

    expect(sales.fields).toEqual([
      { label: "Enero 2026", value: "ARS 3.200.000" },
      { label: "Febrero 2026", value: SUBMITTED_DATA_COPY.sinDato }
    ]);
  });

  it("lists the uploaded documents' metadata with a named kind and the file size", () => {
    const documents = block(view(ALL_READY), "documents");

    expect(documents.fields).toEqual([
      { label: "Constancia de CUIT", value: "constancia-cuit.pdf · 125,5 KB" },
      { label: "Foto", value: "local.jpg · 2 KB" }
    ]);
  });

  it("reports the honest empty note per block instead of an invented row", () => {
    const blocks = view({ business: ok(BUSINESS), request: ok({ ...REQUEST_READ, salesPeriods: [] }), documents: ok([]) });

    expect(block(blocks, "sales").fields).toEqual([]);
    expect(block(blocks, "sales").message).toBe(SUBMITTED_DATA_COPY.salesEmpty);
    expect(block(blocks, "documents").fields).toEqual([]);
    expect(block(blocks, "documents").message).toBe(SUBMITTED_DATA_COPY.documentsEmpty);
  });

  it("degrades only the block whose read failed, leaving the others intact", () => {
    const blocks = view({ ...ALL_READY, business: failed() });

    const company = block(blocks, "company");
    expect(company.state).toBe("failed");
    expect(company.fields).toEqual([]);
    expect(company.message).toBe(SUBMITTED_DATA_COPY.companyFailure);
    // The independent reads are untouched.
    expect(block(blocks, "request").state).toBe("ready");
    expect(block(blocks, "sales").state).toBe("ready");
    expect(block(blocks, "documents").state).toBe("ready");
  });

  it("degrades the request and sales blocks together when the request read fails, without touching the others", () => {
    const blocks = view({ ...ALL_READY, request: failed() });

    expect(block(blocks, "request").state).toBe("failed");
    expect(block(blocks, "sales").state).toBe("failed");
    expect(block(blocks, "company").state).toBe("ready");
    expect(block(blocks, "documents").state).toBe("ready");
  });

  it("degrades only the documents block when the documents read fails", () => {
    const blocks = view({ ...ALL_READY, documents: failed() });

    expect(block(blocks, "documents").state).toBe("failed");
    expect(block(blocks, "company").state).toBe("ready");
    expect(block(blocks, "request").state).toBe("ready");
    expect(block(blocks, "sales").state).toBe("ready");
  });

  it("reports a loading read as loading, never as empty or failed", () => {
    const blocks = view({ business: loading(), request: loading(), documents: loading() });

    for (const entry of blocks) expect(entry.state).toBe("loading");
    expect(blocks.every((entry) => entry.fields.length === 0 && entry.message === null)).toBe(true);
  });

  it("never shapes an AI risk band into any field, message or title", () => {
    const forbidden = [AI_STEP_COPY.riskLabel, ...Object.values(AI_RISK_LABELS)];
    const rendered = JSON.stringify(view(ALL_READY)) + JSON.stringify(view({ ...ALL_READY, request: failed() }));

    for (const term of forbidden) expect(rendered).not.toContain(term);
  });
});
