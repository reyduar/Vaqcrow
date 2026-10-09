import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BusinessPort, BusinessRecord } from "@/application/ports/business-port";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import type {
  SalesDeclarationPeriod,
  SalesDeclarationPort,
  SalesDeclarationResult
} from "@/application/ports/sales-declaration-port";
import { CompanyDeclareSales } from "./company-declare-sales";

const BUSINESS_ID = "b1e6c2a4-9f3d-4a7b-8c1e-5d2f6a9b0c31";
const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";

function campaign(overrides: Partial<MyCampaign> = {}): MyCampaign {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Campaña 2026 · Panadería Horizonte",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    vaultAddress: VAULT,
    state: "funding",
    goalArs: 15_000_000,
    raisedArs: 9_450_000,
    fundedPercentBps: 6_300,
    deadline: "2026-11-30T12:00:00.000Z",
    contributorsCount: 38,
    distributions: [],
    sales: [
      { period: "2026-06", salesArs: 6_240_000, status: "reported" },
      { period: "2026-07", salesArs: null, status: "missing" },
      { period: "2026-08", salesArs: 3_745_800, status: "reported" }
    ],
    ...overrides
  };
}

function business(): BusinessRecord {
  return {
    businessId: BUSINESS_ID,
    ownerUserId: "owner-1",
    name: "Panadería Horizonte",
    cuit: "20123456789",
    sector: "Alimentos",
    city: "Córdoba",
    description: "Panadería de barrio",
    goalArs: 15_000_000,
    revenueShare: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function businessPort(): BusinessPort {
  return {
    getMyBusiness: vi.fn().mockResolvedValue({ ok: true, business: business() }),
    createBusiness: vi.fn()
  } as unknown as BusinessPort;
}

function declarationPort(result: SalesDeclarationResult = { ok: true }) {
  const declare = vi.fn().mockResolvedValue(result);
  return { port: { declare } as SalesDeclarationPort, declare };
}

function renderPanel(overrides: Partial<Parameters<typeof CompanyDeclareSales>[0]> = {}) {
  const onSubmitted = vi.fn();
  const onCancel = vi.fn();
  const { port, declare } = declarationPort();
  render(
    <CompanyDeclareSales
      campaign={campaign()}
      port={port}
      business={businessPort()}
      onSubmitted={onSubmitted}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onSubmitted, onCancel, declare };
}

describe("CompanyDeclareSales", () => {
  it("shows one amount row per declared month, prefilled (null as empty)", () => {
    renderPanel();

    expect(screen.getByLabelText("Ventas de Junio 2026")).toHaveValue("6240000");
    expect(screen.getByLabelText("Ventas de Julio 2026")).toHaveValue("");
    expect(screen.getByLabelText("Ventas de Agosto 2026")).toHaveValue("3745800");
    expect(screen.getByText("Sin dato")).toBeInTheDocument();
  });

  it("fills every row from the demo helper", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Completar con datos de ejemplo" }));

    expect(screen.getByLabelText("Ventas de Junio 2026")).toHaveValue("1850000");
    expect(screen.getByLabelText("Ventas de Julio 2026")).toHaveValue("2090000");
    expect(screen.getByLabelText("Ventas de Agosto 2026")).toHaveValue("2330000");
  });

  it("declares the resolved business id and the periods, then shows Enviada", async () => {
    const { declare, onSubmitted } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Completar con datos de ejemplo" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar declaración" }));

    const expected: readonly SalesDeclarationPeriod[] = [
      { period: "2026-06", salesArs: 1_850_000 },
      { period: "2026-07", salesArs: 2_090_000 },
      { period: "2026-08", salesArs: 2_330_000 }
    ];
    await waitFor(() => expect(declare).toHaveBeenCalledWith(BUSINESS_ID, expected));
    expect(await screen.findByText("Enviada")).toBeInTheDocument();
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("refuses an invalid amount without calling the API", () => {
    const { declare } = renderPanel();

    fireEvent.change(screen.getByLabelText("Ventas de Junio 2026"), { target: { value: "mil" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar declaración" }));

    expect(declare).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("números enteros");
  });

  it("shows an inline error when the declaration fails", async () => {
    const { port } = declarationPort({ ok: false, code: "unavailable" });
    renderPanel({ port });

    fireEvent.click(screen.getByRole("button", { name: "Completar con datos de ejemplo" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar declaración" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos enviar");
  });

  it("cancels through the provided handler", () => {
    const { onCancel } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
