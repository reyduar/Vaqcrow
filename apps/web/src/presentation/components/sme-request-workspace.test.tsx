import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { SmeRequestWorkspace } from "./sme-request-workspace";

function renderWorkspace(gateway: SmeRequestGateway | null) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SmeRequestWorkspace gateway={gateway} />
    </SWRConfig>
  );
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/Total declarado \(ARS\)/), { target: { value: "1200000" } });
  fireEvent.change(screen.getByLabelText(/Período desde/), { target: { value: "2026-01" } });
  fireEvent.change(screen.getByLabelText(/Período hasta/), { target: { value: "2026-03" } });
  fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/ }));
}

describe("SmeRequestWorkspace", () => {
  it("renders the form and the synthetic fallback review without a backend", () => {
    renderWorkspace(null);

    expect(screen.getByRole("form", { name: /Solicitud de financiamiento/ })).toBeInTheDocument();
    const review = screen.getByRole("region", { name: /Revisión de evidencia/ });
    expect(review).toHaveTextContent("Abril 2026");
    expect(review).toHaveTextContent("Junio 2026");
    expect(review).toHaveTextContent("Total declarado no coincide");
    expect(screen.getAllByText("SIMULADO").length).toBeGreaterThan(0);
  });

  it("never claims success when there is no backend", async () => {
    renderWorkspace(null);

    fillAndSubmit();

    expect(await screen.findByText(/no está disponible/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows sanitized backend field errors next to the field and no success message", async () => {
    const gateway: SmeRequestGateway = {
      submit: vi.fn().mockRejectedValue(new HttpClientError("http", 422, { periodEnd: "before_start", evil: "x" })),
      loadCurrent: vi.fn().mockResolvedValue({ request: null, salesPeriods: [] })
    };
    renderWorkspace(gateway);

    fillAndSubmit();

    expect(await screen.findByText(/período final no puede ser anterior/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Período hasta/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a success status only after the gateway resolved", async () => {
    const request = {
      smeReference: "sme:SYN-PH-0001",
      declaredTotalArs: 1_200_000,
      periodStart: "2026-01",
      periodEnd: "2026-03",
      simuladoLabel: "SIMULADO" as const
    };
    const gateway: SmeRequestGateway = {
      submit: vi.fn().mockResolvedValue(request),
      loadCurrent: vi.fn().mockResolvedValue({ request: null, salesPeriods: [] })
    };
    renderWorkspace(gateway);

    fillAndSubmit();

    expect(await screen.findByRole("status")).toHaveTextContent(/Solicitud registrada/);
  });

  it("replaces the fallback review with backend data once loaded", async () => {
    const gateway: SmeRequestGateway = {
      submit: vi.fn(),
      loadCurrent: vi.fn().mockResolvedValue({
        request: {
          smeReference: "sme:B",
          declaredTotalArs: 100,
          periodStart: "2026-01",
          periodEnd: "2026-01",
          simuladoLabel: "SIMULADO"
        },
        salesPeriods: [
          { period: "2026-01", amountArs: 50, status: "reported", evidenceRef: "e:1", simuladoLabel: "SIMULADO" }
        ]
      })
    };
    renderWorkspace(gateway);

    await waitFor(() =>
      expect(screen.getByRole("region", { name: /Revisión de evidencia/ })).not.toHaveTextContent("Junio 2026")
    );
    expect(screen.getByRole("region", { name: /Revisión de evidencia/ })).toHaveTextContent(
      "Total declarado no coincide"
    );
  });

  it("tells the user when loading failed and keeps the synthetic review", async () => {
    const gateway: SmeRequestGateway = {
      submit: vi.fn(),
      loadCurrent: vi.fn().mockRejectedValue(new HttpClientError("network"))
    };
    renderWorkspace(gateway);

    expect(await screen.findByText(/No se pudo cargar/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Revisión de evidencia/ })).toHaveTextContent("Junio 2026");
  });
});
