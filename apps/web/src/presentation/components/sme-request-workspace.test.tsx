import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { JourneyStoreProvider } from "@/state/journey-store-provider";
import { SmeRequestWorkspace } from "./sme-request-workspace";

function renderWorkspace(gateway: SmeRequestGateway | null) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <JourneyStoreProvider>
        <SmeRequestWorkspace gateway={gateway} />
      </JourneyStoreProvider>
    </SWRConfig>
  );
}

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

const SAVED_REQUEST = {
  smeReference: "sme:SYN-PH-0001",
  declaredTotalArs: 1_200_000,
  periodStart: "2026-01",
  periodEnd: "2026-03",
  simuladoLabel: "SIMULADO" as const
};

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
      load: vi.fn().mockResolvedValue({ request: SAVED_REQUEST, salesPeriods: [] })
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
      submit: vi.fn().mockResolvedValue({ applicationId: APPLICATION_ID, request }),
      load: vi.fn().mockResolvedValue({ request: SAVED_REQUEST, salesPeriods: [] })
    };
    renderWorkspace(gateway);

    fillAndSubmit();

    expect(await screen.findByRole("status")).toHaveTextContent(/Solicitud registrada/);
  });

  it("replaces the fallback review with backend data once loaded", async () => {
    const gateway: SmeRequestGateway = {
      submit: vi.fn().mockResolvedValue({ applicationId: APPLICATION_ID, request: SAVED_REQUEST }),
      load: vi.fn().mockResolvedValue({
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
    expect(gateway.load).not.toHaveBeenCalled();

    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole("region", { name: /Revisión de evidencia/ })).not.toHaveTextContent("Junio 2026")
    );
    expect(screen.getByRole("region", { name: /Revisión de evidencia/ })).toHaveTextContent(
      "Total declarado no coincide"
    );
  });

  it("tells the user when loading failed and keeps the synthetic review", async () => {
    const gateway: SmeRequestGateway = {
      submit: vi.fn().mockResolvedValue({ applicationId: APPLICATION_ID, request: SAVED_REQUEST }),
      load: vi.fn().mockRejectedValue(new HttpClientError("network"))
    };
    renderWorkspace(gateway);

    fillAndSubmit();

    expect(await screen.findByText(/No se pudo cargar/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Revisión de evidencia/ })).toHaveTextContent("Junio 2026");
  });

  it("shows the connection message and no success when the submit fails with a network error", async () => {
    const gateway: SmeRequestGateway = {
      submit: vi.fn().mockRejectedValue(new HttpClientError("network")),
      load: vi.fn().mockResolvedValue({ request: SAVED_REQUEST, salesPeriods: [] })
    };
    renderWorkspace(gateway);

    fillAndSubmit();

    expect(await screen.findByText(/No hay conexión con el servicio/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not leak unknown backend fields or raw text into the visible copy on a 422", async () => {
    const gateway: SmeRequestGateway = {
      submit: vi.fn().mockRejectedValue(new HttpClientError("http", 422, { evil: "leak_me", declaredTotalArs: "constructor" })),
      load: vi.fn().mockResolvedValue({ request: SAVED_REQUEST, salesPeriods: [] })
    };
    const { container } = renderWorkspace(gateway);

    fillAndSubmit();

    expect(await screen.findByText(/No se pudo enviar la solicitud/)).toBeInTheDocument();
    expect(container).not.toHaveTextContent("leak_me");
    expect(container).not.toHaveTextContent("constructor");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("clears the earlier server error and shows success when a retry is accepted", async () => {
    const request = {
      smeReference: "sme:SYN-PH-0001",
      declaredTotalArs: 1_200_000,
      periodStart: "2026-01",
      periodEnd: "2026-03",
      simuladoLabel: "SIMULADO" as const
    };
    const gateway: SmeRequestGateway = {
      submit: vi
        .fn()
        .mockRejectedValueOnce(new HttpClientError("network"))
        .mockResolvedValueOnce({ applicationId: APPLICATION_ID, request }),
      load: vi.fn().mockResolvedValue({ request: SAVED_REQUEST, salesPeriods: [] })
    };
    renderWorkspace(gateway);

    fillAndSubmit();
    expect(await screen.findByText(/No hay conexión con el servicio/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/ }));

    expect(await screen.findByRole("status")).toHaveTextContent(/Solicitud registrada/);
    expect(screen.queryByText(/No hay conexión con el servicio/)).not.toBeInTheDocument();
  });

  it("does not call the gateway when the amount is not an integer of pesos", async () => {
    const gateway: SmeRequestGateway = {
      submit: vi.fn(),
      load: vi.fn().mockResolvedValue({ request: SAVED_REQUEST, salesPeriods: [] })
    };
    renderWorkspace(gateway);

    fireEvent.change(screen.getByLabelText(/Total declarado \(ARS\)/), { target: { value: "1200.50" } });
    fireEvent.change(screen.getByLabelText(/Período desde/), { target: { value: "2026-01" } });
    fireEvent.change(screen.getByLabelText(/Período hasta/), { target: { value: "2026-03" } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar solicitud/ }));

    await waitFor(() => expect(screen.getByLabelText(/Total declarado \(ARS\)/)).toHaveAttribute("aria-invalid", "true"));
    expect(gateway.submit).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("disables the submit control and ignores a second click while a request is in flight", async () => {
    let resolveSubmit: (value: { applicationId: string; request: typeof SAVED_REQUEST }) => void = () => undefined;
    const submit = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );
    const gateway: SmeRequestGateway = {
      submit,
      load: vi.fn().mockResolvedValue({ request: SAVED_REQUEST, salesPeriods: [] })
    };
    renderWorkspace(gateway);

    fillAndSubmit();

    const pending = await screen.findByRole("button", { name: /Enviando/ });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(submit).toHaveBeenCalledTimes(1);

    resolveSubmit({ applicationId: APPLICATION_ID, request: SAVED_REQUEST });

    expect(await screen.findByRole("button", { name: /Enviar solicitud/ })).toBeEnabled();
  });
});
