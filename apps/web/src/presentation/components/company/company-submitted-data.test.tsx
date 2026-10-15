import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { MyDocument, SmeRequestRead } from "@vaqcrow/contracts";
import { AI_RISK_LABELS, AI_STEP_COPY } from "@/application/pyme-onboarding/ai-step";
import type { BusinessPort, BusinessRecord } from "@/application/ports/business-port";
import type { MyDocumentsPort, MyDocumentsResult } from "@/application/ports/my-documents-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { CompanySubmittedData } from "./company-submitted-data";

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

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
    { period: "2026-01", amountArs: 3_200_000, status: "reported", evidenceRef: "sales:1", simuladoLabel: "SIMULADO" }
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

function businessPort(result: { ok: true; business: BusinessRecord } | { ok: false } = { ok: true, business: BUSINESS }) {
  const getMyBusiness = vi
    .fn()
    .mockResolvedValue(result.ok ? result : { ok: false, code: "unavailable" });
  return { port: { getMyBusiness, createBusiness: vi.fn() } as unknown as BusinessPort, getMyBusiness };
}

function documentsPort(result: MyDocumentsResult = { ok: true, documents: [DOCUMENT] }) {
  const listMine = vi.fn().mockResolvedValue(result);
  return { port: { listMine } as MyDocumentsPort, listMine };
}

function requestGateway(outcome: SmeRequestRead | Error = REQUEST_READ) {
  const load = outcome instanceof Error ? vi.fn().mockRejectedValue(outcome) : vi.fn().mockResolvedValue(outcome);
  return { gateway: { submit: vi.fn(), loadMine: vi.fn(), load } as SmeRequestGateway, load };
}

function renderPanel(overrides: Partial<Parameters<typeof CompanySubmittedData>[0]> = {}) {
  const onClose = vi.fn();
  const business = businessPort();
  const documents = documentsPort();
  const { gateway } = requestGateway();
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CompanySubmittedData
        applicationId={APPLICATION_ID}
        business={business.port}
        documents={documents.port}
        smeRequestGateway={gateway}
        onClose={onClose}
        {...overrides}
      />
    </SWRConfig>
  );
  return { onClose, business, documents };
}

const region = () => screen.getByRole("region", { name: "Datos enviados de tu solicitud" });

describe("CompanySubmittedData", () => {
  it("shows the persisted company, request and documents read-only", async () => {
    renderPanel();

    await waitFor(() => expect(within(region()).getByText("Panadería Horizonte")).toBeInTheDocument());
    expect(within(region()).getByText("Alimentos")).toBeInTheDocument();
    expect(within(region()).getByText("Córdoba")).toBeInTheDocument();
    expect(within(region()).getByText("ARS 15.000.000")).toBeInTheDocument();
    expect(within(region()).getByText("sme:SYN-1")).toBeInTheDocument();
    expect(within(region()).getByText("ARS 9.700.000")).toBeInTheDocument();
    expect(within(region()).getByText("Enero 2026 – Marzo 2026")).toBeInTheDocument();
    expect(within(region()).getByText("Enero 2026")).toBeInTheDocument();
    expect(within(region()).getByText("ARS 3.200.000")).toBeInTheDocument();
    expect(within(region()).getByText("constancia-cuit.pdf · 125,5 KB")).toBeInTheDocument();
  });

  it("has no actionable control other than the close button (read-only)", async () => {
    renderPanel();

    await waitFor(() => expect(within(region()).getByText("Panadería Horizonte")).toBeInTheDocument());
    const buttons = within(region()).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Volver a Mi campaña"]);
    expect(within(region()).queryAllByRole("textbox")).toEqual([]);
  });

  it("never renders the simulated AI risk band", async () => {
    renderPanel();

    await waitFor(() => expect(within(region()).getByText("Panadería Horizonte")).toBeInTheDocument());
    expect(screen.queryByText(AI_STEP_COPY.riskLabel)).not.toBeInTheDocument();
    for (const label of Object.values(AI_RISK_LABELS)) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/banda de riesgo/i)).not.toBeInTheDocument();
  });

  it("never renders a storage object path", async () => {
    renderPanel();

    await waitFor(() => expect(within(region()).getByText("constancia-cuit.pdf · 125,5 KB")).toBeInTheDocument());
    expect(region().textContent).not.toMatch(/objectPath|s3:\/\/|\/storage\/|storage:v1/i);
  });

  it("degrades only the company block when the business read fails, keeping the rest", async () => {
    renderPanel({ business: businessPort({ ok: false }).port });

    expect(await within(region()).findByText("No pudimos leer los datos de tu empresa.")).toBeInTheDocument();
    const company = screen.getByRole("region", { name: "Empresa" });
    expect(company).not.toHaveTextContent("Panadería Horizonte");
    // The independent reads still render.
    await waitFor(() => expect(within(region()).getByText("sme:SYN-1")).toBeInTheDocument());
    expect(within(region()).getByText("constancia-cuit.pdf · 125,5 KB")).toBeInTheDocument();
  });

  it("degrades only the documents block when the documents read fails, keeping the rest", async () => {
    renderPanel({ documents: documentsPort({ ok: false, code: "unavailable" }).port });

    expect(await within(region()).findByText("No pudimos leer los documentos cargados.")).toBeInTheDocument();
    expect(within(region()).queryByText("constancia-cuit.pdf · 125,5 KB")).not.toBeInTheDocument();
    await waitFor(() => expect(within(region()).getByText("Panadería Horizonte")).toBeInTheDocument());
    expect(within(region()).getByText("sme:SYN-1")).toBeInTheDocument();
  });

  it("degrades the request and sales blocks when the request read fails, keeping the rest", async () => {
    const { gateway } = requestGateway(new Error("boom"));
    renderPanel({ smeRequestGateway: gateway });

    expect(await within(region()).findByText("No pudimos leer tu solicitud.")).toBeInTheDocument();
    expect(within(region()).getByText("No pudimos leer las ventas declaradas.")).toBeInTheDocument();
    await waitFor(() => expect(within(region()).getByText("Panadería Horizonte")).toBeInTheDocument());
    expect(within(region()).getByText("constancia-cuit.pdf · 125,5 KB")).toBeInTheDocument();
  });

  it("degrades honestly with no backend configured (null ports)", async () => {
    renderPanel({ business: null, documents: null, smeRequestGateway: null });

    expect(await within(region()).findByText("No pudimos leer los datos de tu empresa.")).toBeInTheDocument();
    expect(within(region()).getByText("No pudimos leer tu solicitud.")).toBeInTheDocument();
    expect(within(region()).getByText("No pudimos leer los documentos cargados.")).toBeInTheDocument();
  });

  it("closes through the provided handler", async () => {
    const { onClose } = renderPanel();

    await waitFor(() => expect(within(region()).getByText("Panadería Horizonte")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Volver a Mi campaña" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
