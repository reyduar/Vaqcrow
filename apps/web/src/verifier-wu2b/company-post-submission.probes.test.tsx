/**
 * Verifier probes — Feature #530, work unit WU2b (web).
 *
 * Covers, independently of the writer's suite:
 *  - S4: «Ver lo enviado» is read-only and renders only persisted facts; the
 *        simulated AI risk band and any storage object path are never rendered;
 *        each read degrades on its own (per block) and never fabricates a value.
 *  - S1-contrato: «Ver lo enviado» appears exactly when «Registrar mi PyME» is
 *        hidden; closing returns to the normal view; the wizard and the
 *        in-session/fresh-session paths still work.
 *  - Conventions: the documents read is owner-scoped on the wire and its success
 *        body is strictly parsed (a leaked objectPath / unknown key is refused).
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationReviewState, MyDocument, SmeRequest, SmeRequestRead } from "@vaqcrow/contracts";
import { AI_RISK_LABELS, AI_STEP_COPY } from "@/application/pyme-onboarding/ai-step";
import { SUBMITTED_DATA_COPY, submittedDataView } from "@/application/company/submitted-data";
import { HttpClientError, type HttpClientPort } from "@/application/ports/http-client-port";
import type { BusinessPort, BusinessRecord } from "@/application/ports/business-port";
import type { MyCampaignsPort } from "@/application/ports/my-campaigns-port";
import type { MyDocumentsPort, MyDocumentsResult } from "@/application/ports/my-documents-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { HttpMyDocumentsGateway } from "@/infrastructure/company/http-my-documents-gateway";
import { createBrowserMyDocumentsPort, createMyDocumentsPort } from "@/infrastructure/company/create-my-documents-port";
import { CompanySubmittedData } from "@/presentation/components/company/company-submitted-data";
import { CompanyWorkspace } from "@/presentation/components/pyme-onboarding/company-workspace";
import { FakeKyc } from "@/test/fake-kyc";
import { FakeWalletBalance, FakeWalletConnection } from "@/test/fake-wallet";

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const REGISTRAR = "Registrar mi PyME";
const VER = "Ver lo enviado";
const REGION = "Datos enviados de tu solicitud";

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

const SME_REQUEST: SmeRequest = {
  smeReference: "sme:REF-1",
  declaredTotalArs: 9_700_000,
  periodStart: "2026-01",
  periodEnd: "2026-03",
  simuladoLabel: "SIMULADO"
};

const REQUEST_READ: SmeRequestRead = {
  request: SME_REQUEST,
  salesPeriods: [
    { period: "2026-01", amountArs: 3_200_000, status: "reported", evidenceRef: "sales:1", simuladoLabel: "SIMULADO" },
    { period: "2026-02", amountArs: null, status: "missing", evidenceRef: "sales:2", simuladoLabel: "SIMULADO" }
  ],
  state: "human_review"
};

const DOCUMENT: MyDocument = {
  documentId: "11111111-1111-4111-8111-111111111111",
  kind: "cuit",
  name: "constancia-cuit.pdf",
  sizeBytes: 128_512,
  contentType: "application/pdf",
  createdAt: "2026-10-03T12:00:00.000Z"
};

/** A hand-rolled port that leaks a storage path key at runtime (schema bypassed). */
const LEAKY_DOCUMENT = { ...DOCUMENT, objectPath: "s3://vaqcrow-secret/pyme/42/constancia.pdf" };
const AI_TERMS = [AI_STEP_COPY.riskLabel, ...Object.values(AI_RISK_LABELS)];

const okBiz = (): BusinessPort =>
  ({ getMyBusiness: vi.fn().mockResolvedValue({ ok: true, business: BUSINESS }), createBusiness: vi.fn() } as unknown as BusinessPort);
const failBiz = (): BusinessPort =>
  ({ getMyBusiness: vi.fn().mockResolvedValue({ ok: false, code: "unavailable" }), createBusiness: vi.fn() } as unknown as BusinessPort);
const okDocs = (documents: readonly unknown[] = [DOCUMENT]): MyDocumentsPort =>
  ({ listMine: vi.fn().mockResolvedValue({ ok: true, documents }) } as unknown as MyDocumentsPort);
const resDocs = (result: MyDocumentsResult): MyDocumentsPort => ({ listMine: vi.fn().mockResolvedValue(result) });
const okReq = (): SmeRequestGateway =>
  ({ submit: vi.fn(), loadMine: vi.fn(), load: vi.fn().mockResolvedValue(REQUEST_READ) });
const failReq = (): SmeRequestGateway =>
  ({ submit: vi.fn(), loadMine: vi.fn(), load: vi.fn().mockRejectedValue(new Error("boom")) });
const okCampaigns = (): MyCampaignsPort => ({ get: async () => ({ ok: true, myCampaigns: { campaigns: [] } }) });

const gw = (
  loadMine: { ok: true; application: { applicationId: string; state: ApplicationReviewState } | null } = { ok: true, application: null }
): SmeRequestGateway => ({
  submit: vi.fn(),
  load: vi.fn().mockResolvedValue({ request: SME_REQUEST, salesPeriods: [], state: "human_review" }),
  loadMine: vi.fn().mockResolvedValue(loadMine)
});

const panel = () => screen.getByRole("region", { name: REGION });

// ---------------------------------------------------------------------------
// S4 — the pure view-model shapes only persisted facts.
// ---------------------------------------------------------------------------
describe("S4 view-model: only persisted facts, honest per block", () => {
  const view = (over: Partial<Parameters<typeof submittedDataView>[0]> = {}) =>
    submittedDataView({
      business: { status: "ok", value: BUSINESS },
      request: { status: "ok", value: REQUEST_READ },
      documents: { status: "ok", value: [DOCUMENT] },
      ...over
    });
  const block = (key: string) => view().find((entry) => entry.key === key)!;

  it("orders company, request, sales, documents and shapes company name/sector/city/goal", () => {
    expect(view().map((entry) => entry.key)).toEqual(["company", "request", "sales", "documents"]);
    expect(block("company").fields.map((field) => field.value)).toEqual([
      "Panadería Horizonte",
      "Alimentos",
      "Córdoba",
      "ARS 15.000.000"
    ]);
  });

  it("shapes the request (reference, total, period) and the declared months (a missing month is «Sin dato», never 0)", () => {
    expect(block("request").fields.map((field) => field.value)).toEqual(["sme:REF-1", "ARS 9.700.000", "Enero 2026 – Marzo 2026"]);
    expect(block("sales").fields.map((field) => field.value)).toEqual(["ARS 3.200.000", SUBMITTED_DATA_COPY.sinDato]);
  });

  it("lists the documents' metadata only", () => {
    expect(block("documents").fields).toEqual([{ label: "Constancia de CUIT", value: "constancia-cuit.pdf · 125,5 KB" }]);
  });

  it("degrades only the block whose read failed; the independent reads survive", () => {
    for (const key of ["business", "request", "documents"] as const) {
      const blocks = view({ [key]: { status: "failed" } } as never);
      const failed = blocks.filter((entry) => entry.state === "failed").map((entry) => entry.key);
      const expected = key === "request" ? ["request", "sales"] : key === "business" ? ["company"] : [key];
      expect(failed).toEqual(expected);
      expect(blocks.filter((entry) => entry.state === "ready").length).toBe(4 - expected.length);
    }
  });

  it("never shapes an AI band term into any field, title or message", () => {
    const rendered = JSON.stringify(view()) + JSON.stringify(view({ request: { status: "failed" } }));
    for (const term of AI_TERMS) expect(rendered).not.toContain(term);
  });
});

// ---------------------------------------------------------------------------
// S4 — the read-only panel: independent degradation, no simulated value/path.
// ---------------------------------------------------------------------------
describe("S4 panel: independent degradation and honesty", () => {
  function renderPanel(over: { business?: BusinessPort | null; documents?: MyDocumentsPort | null; smeRequestGateway?: SmeRequestGateway | null } = {}) {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CompanySubmittedData
          applicationId={APPLICATION_ID}
          business={over.business === undefined ? okBiz() : over.business}
          documents={over.documents === undefined ? okDocs() : over.documents}
          smeRequestGateway={over.smeRequestGateway === undefined ? okReq() : over.smeRequestGateway}
          onClose={vi.fn()}
        />
      </SWRConfig>
    );
  }

  it("business fails -> only company degrades; request/sales/documents render", async () => {
    renderPanel({ business: failBiz() });
    expect(await within(panel()).findByText(SUBMITTED_DATA_COPY.companyFailure)).toBeInTheDocument();
    expect(screen.queryByText("Panadería Horizonte")).not.toBeInTheDocument();
    expect(within(panel()).getByText("sme:REF-1")).toBeInTheDocument();
    expect(within(panel()).getByText("constancia-cuit.pdf · 125,5 KB")).toBeInTheDocument();
  });

  it("documents fail -> only documents degrade, and an empty list is NOT substituted", async () => {
    renderPanel({ documents: resDocs({ ok: false, code: "unavailable" }) });
    expect(await within(panel()).findByText(SUBMITTED_DATA_COPY.documentsFailure)).toBeInTheDocument();
    expect(within(panel()).queryByText(SUBMITTED_DATA_COPY.documentsEmpty)).not.toBeInTheDocument();
    expect(within(panel()).getByText("Panadería Horizonte")).toBeInTheDocument();
    expect(within(panel()).getByText("sme:REF-1")).toBeInTheDocument();
  });

  it("request fails -> request and sales degrade; company/documents render", async () => {
    renderPanel({ smeRequestGateway: failReq() });
    expect(await within(panel()).findByText(SUBMITTED_DATA_COPY.requestFailure)).toBeInTheDocument();
    expect(within(panel()).getByText(SUBMITTED_DATA_COPY.salesFailure)).toBeInTheDocument();
    expect(within(panel()).getByText("Panadería Horizonte")).toBeInTheDocument();
    expect(within(panel()).getByText("constancia-cuit.pdf · 125,5 KB")).toBeInTheDocument();
  });

  it("all reads fail -> view is not blanked, every honest message shows, close remains", async () => {
    renderPanel({ business: null, documents: null, smeRequestGateway: null });
    expect(await within(panel()).findByText(SUBMITTED_DATA_COPY.companyFailure)).toBeInTheDocument();
    expect(within(panel()).getByText(SUBMITTED_DATA_COPY.requestFailure)).toBeInTheDocument();
    expect(within(panel()).getByText(SUBMITTED_DATA_COPY.salesFailure)).toBeInTheDocument();
    expect(within(panel()).getByText(SUBMITTED_DATA_COPY.documentsFailure)).toBeInTheDocument();
    expect(within(panel()).getByRole("button", { name: SUBMITTED_DATA_COPY.close })).toBeInTheDocument();
    expect(within(panel()).queryByText("ARS 15.000.000")).not.toBeInTheDocument();
  });

  it("an honest empty documents list is distinct from a failure, and no read gets stuck loading", async () => {
    renderPanel({ documents: resDocs({ ok: true, documents: [] }) });
    expect(await within(panel()).findByText(SUBMITTED_DATA_COPY.documentsEmpty)).toBeInTheDocument();
    expect(within(panel()).queryByText(SUBMITTED_DATA_COPY.documentsFailure)).not.toBeInTheDocument();
    await waitFor(() => expect(within(panel()).queryByText(SUBMITTED_DATA_COPY.loading)).not.toBeInTheDocument());
  });

  it("never renders the AI band and never a storage object path (even a port that leaks one)", async () => {
    renderPanel({ documents: okDocs([LEAKY_DOCUMENT]) });
    const region = panel();
    await waitFor(() => expect(within(region).getByText("constancia-cuit.pdf · 125,5 KB")).toBeInTheDocument());
    const text = document.body.textContent ?? "";
    for (const term of AI_TERMS) expect(text).not.toContain(term);
    expect(text).not.toMatch(/banda de riesgo/i);
    expect(text).not.toMatch(/objectPath|s3:\/\/|vaqcrow-secret|\/storage\//i);
  });
});

// ---------------------------------------------------------------------------
// S1-contrato — the action's visibility, close, wizard and session paths.
// ---------------------------------------------------------------------------
describe("S1-contrato: «Ver lo enviado» visibility", () => {
  const TERMINAL = ["awaiting_assessment", "human_review", "approved", "changes_requested", "rejected"] as const;
  const NOT_SENT = [null, "draft"] as const;

  function renderState(state: ApplicationReviewState | null, props: { applicationId?: string } = {}) {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CompanyWorkspace
          kyc={new FakeKyc()}
          connection={new FakeWalletConnection()}
          balance={new FakeWalletBalance()}
          myCampaigns={okCampaigns()}
          smeRequestGateway={gw()}
          applicationState={state}
          {...props}
        />
      </SWRConfig>
    );
  }

  it.each(TERMINAL)("state %s hides Registrar and shows Ver lo enviado", (state) => {
    renderState(state);
    expect(screen.queryByRole("button", { name: REGISTRAR })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: VER })).toBeInTheDocument();
  });

  it.each(NOT_SENT)("state %s shows Registrar and hides Ver lo enviado", (state) => {
    renderState(state);
    expect(screen.getByRole("button", { name: REGISTRAR })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: VER })).not.toBeInTheDocument();
  });

  it("never offers both actions at once for any state", () => {
    for (const state of [...TERMINAL, ...NOT_SENT]) {
      const { unmount } = render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <CompanyWorkspace
            kyc={new FakeKyc()}
            connection={new FakeWalletConnection()}
            balance={new FakeWalletBalance()}
            myCampaigns={okCampaigns()}
            smeRequestGateway={gw()}
            applicationState={state}
          />
        </SWRConfig>
      );
      expect(screen.queryAllByRole("button", { name: REGISTRAR }).length + screen.queryAllByRole("button", { name: VER }).length).toBe(1);
      unmount();
    }
  });

  it("opens the panel and closing returns to the normal view", () => {
    renderState("human_review");
    fireEvent.click(screen.getByRole("button", { name: VER }));
    const region = panel();
    expect(screen.queryByRole("heading", { level: 1, name: "Mi campaña" })).not.toBeInTheDocument();

    fireEvent.click(within(region).getByRole("button", { name: SUBMITTED_DATA_COPY.close }));
    expect(screen.getByRole("heading", { level: 1, name: "Mi campaña" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: VER })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: REGION })).not.toBeInTheDocument();
  });

  it("still opens the wizard from «Registrar mi PyME»", () => {
    renderState(null);
    fireEvent.click(screen.getByRole("button", { name: REGISTRAR }));
    expect(screen.getByRole("heading", { level: 1, name: "Verificación de identidad" })).toBeInTheDocument();
  });

  it("in-session id + terminal state offers Ver lo enviado", async () => {
    renderState("human_review", { applicationId: APPLICATION_ID });
    expect(await screen.findByRole("button", { name: VER })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REGISTRAR })).not.toBeInTheDocument();
  });

  it("fresh session: the owner-scoped read resolves the state and offers Ver lo enviado", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CompanyWorkspace
          kyc={new FakeKyc()}
          connection={new FakeWalletConnection()}
          balance={new FakeWalletBalance()}
          myCampaigns={okCampaigns()}
          smeRequestGateway={gw({ ok: true, application: { applicationId: APPLICATION_ID, state: "human_review" } })}
        />
      </SWRConfig>
    );
    expect(await screen.findByRole("button", { name: VER })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REGISTRAR })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Conventions — owner-scoped wire, strict success parse.
// ---------------------------------------------------------------------------
describe("documents read: owner-scoped wire and strict parse", () => {
  const client = (body: unknown, status = 200) => {
    const send = vi.fn().mockResolvedValue({ status, body });
    return { port: { send } as unknown as HttpClientPort, send };
  };
  const failing = (error: HttpClientError) => ({ port: { send: vi.fn().mockRejectedValue(error) } as unknown as HttpClientPort });

  it("sends only GET /pyme-documents/mine with no client-supplied identity", async () => {
    const { port, send } = client({ documents: [] });
    await new HttpMyDocumentsGateway(port).listMine();
    expect(send).toHaveBeenCalledWith({ method: "GET", path: "/pyme-documents/mine" });
    expect(JSON.stringify(send.mock.calls[0]![0])).not.toMatch(/owner|userId|user_id/i);
  });

  it("refuses a leaked objectPath, an unknown key, a bad id/kind/size and a missing field", async () => {
    const bad = [
      { ...DOCUMENT, objectPath: "s3://bucket/secret" },
      { ...DOCUMENT, sneaky: true }
    ];
    for (const body of bad) {
      await expect(new HttpMyDocumentsGateway(client({ documents: [body] }).port).listMine()).resolves.toEqual({ ok: false, code: "unavailable" });
    }
    await expect(new HttpMyDocumentsGateway(client({ documents: [DOCUMENT], extra: 1 }).port).listMine()).resolves.toEqual({ ok: false, code: "unavailable" });
    for (const d of [{ ...DOCUMENT, documentId: "not-a-uuid" }, { ...DOCUMENT, kind: "invented" }, { ...DOCUMENT, sizeBytes: -1 }, { ...DOCUMENT, sizeBytes: 1.5 }]) {
      await expect(new HttpMyDocumentsGateway(client({ documents: [d] }).port).listMine()).resolves.toEqual({ ok: false, code: "unavailable" });
    }
    const { sizeBytes: _drop, ...missing } = DOCUMENT;
    await expect(new HttpMyDocumentsGateway(client({ documents: [missing] }).port).listMine()).resolves.toEqual({ ok: false, code: "unavailable" });
  });

  it("resolves a valid list (and an honest empty one) and maps errors to sanitized codes", async () => {
    await expect(new HttpMyDocumentsGateway(client({ documents: [DOCUMENT] }).port).listMine()).resolves.toEqual({ ok: true, documents: [DOCUMENT] });
    for (const [error, code] of [
      [new HttpClientError("http", 401), "unauthenticated"],
      [new HttpClientError("http", 403), "unauthenticated"],
      [new HttpClientError("http", 500), "unavailable"],
      [new HttpClientError("network"), "network"]
    ] as const) {
      await expect(new HttpMyDocumentsGateway(failing(error).port).listMine()).resolves.toEqual({ ok: false, code });
    }
  });

  it("no base URL -> null port, never a fabricated empty list", () => {
    expect(createMyDocumentsPort(undefined)).toBeNull();
    expect(createMyDocumentsPort("   ")).toBeNull();
    expect(createMyDocumentsPort("http://localhost:3000")).toBeInstanceOf(HttpMyDocumentsGateway);
    const previous = process.env["NEXT_PUBLIC_API_BASE_URL"];
    delete process.env["NEXT_PUBLIC_API_BASE_URL"];
    try {
      expect(createBrowserMyDocumentsPort()).toBeNull();
    } finally {
      if (previous !== undefined) process.env["NEXT_PUBLIC_API_BASE_URL"] = previous;
    }
  });
});
