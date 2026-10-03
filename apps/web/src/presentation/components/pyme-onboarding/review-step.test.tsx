import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { SmeRequest } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { DEMO_VALUES } from "@/application/pyme-onboarding/registration-step";
import { FakeWallet } from "@/test/fake-wallet";
import { ReviewStep } from "./review-step";

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const REQUEST: SmeRequest = {
  smeReference: "30712345678",
  declaredTotalArs: 27138250,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

function gateway(overrides: Partial<SmeRequestGateway> = {}): SmeRequestGateway {
  return {
    submit: vi.fn().mockResolvedValue({ applicationId: APPLICATION_ID, request: REQUEST }),
    load: vi.fn(),
    ...overrides
  };
}

function renderReview(props: Partial<React.ComponentProps<typeof ReviewStep>> = {}) {
  const onEdit = vi.fn();
  const onDone = vi.fn();
  const wallet = props.wallet ?? new FakeWallet();
  const gw = props.gateway === undefined ? gateway() : props.gateway;
  render(<ReviewStep wallet={wallet} gateway={gw} values={DEMO_VALUES} onEdit={onEdit} onDone={onDone} {...props} />);
  return { onEdit, onDone, wallet, gw };
}

function nextStepRows(): HTMLElement[] {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

describe("ReviewStep before sending", () => {
  it("renders the not-sent banner, the heading and the five template steps", () => {
    renderReview();

    expect(screen.getByText("Revisá y enviá tu solicitud.")).toBeInTheDocument();
    expect(screen.getByText(/Todavía no fue enviada a revisión\./)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Qué pasa ahora" })).toBeInTheDocument();

    const rows = nextStepRows();
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("Solicitud lista");
    expect(rows[0]).toHaveTextContent("Pendiente");
    expect(rows[3]).toHaveTextContent("Revisión humana");
    expect(rows[3]).toHaveTextContent("Pendiente");

    expect(screen.getByRole("button", { name: /Enviar a revisión/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar lo cargado" })).toBeInTheDocument();
  });

  it("returns to step 2 with Revisar lo cargado", () => {
    const { onEdit } = renderReview();
    fireEvent.click(screen.getByRole("button", { name: "Revisar lo cargado" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe("ReviewStep wallet gate", () => {
  it("turns the wallet step red and blocks sending without a connected wallet", () => {
    const gw = gateway();
    renderReview({ gateway: gw });
    const rows = nextStepRows();

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));

    expect(rows[2]).toHaveTextContent("Obligatorio");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Conectá tu wallet Freighter para poder enviar la solicitud a revisión."
    );
    expect(gw.submit).not.toHaveBeenCalled();
  });

  it("connects Freighter and then sends the mapped request", async () => {
    const wallet = new FakeWallet();
    wallet.seedAccount("GBXK1234567890ABCD7Q2M");
    const gw = gateway();
    const { onDone } = renderReview({ wallet, gateway: gw });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });

    expect(screen.queryByText("Obligatorio")).not.toBeInTheDocument();
    expect(nextStepRows()[2]).toHaveTextContent("Completo");
    expect(nextStepRows()[2]).toHaveTextContent("GBXK…7Q2M");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });

    expect(gw.submit).toHaveBeenCalledWith(REQUEST);
    expect(screen.getByText("Solicitud enviada a revisión. Te avisamos cuando haya una decisión.")).toBeInTheDocument();
    expect(nextStepRows()[3]).toHaveTextContent("En proceso");

    fireEvent.click(screen.getByRole("button", { name: /Ir a Mi campaña/ }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("surfaces a friendly message when Freighter cannot be connected", async () => {
    const wallet = new FakeWallet();
    wallet.failNextConnect("unavailable");
    renderReview({ wallet });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });

    expect(screen.getByText("No pudimos conectar Freighter. Probá de nuevo.")).toBeInTheDocument();
  });
});

describe("ReviewStep send", () => {
  it("reports a sanitized failure and allows a retry", async () => {
    const wallet = new FakeWallet();
    wallet.seedAccount("GBXK1234567890ABCD7Q2M");
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ applicationId: APPLICATION_ID, request: REQUEST });
    renderReview({ wallet, gateway: gateway({ submit }) });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo enviar la solicitud.");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });
    expect(screen.getByText("Solicitud enviada a revisión. Te avisamos cuando haya una decisión.")).toBeInTheDocument();
  });

  it("says the service is unavailable when no gateway is configured", async () => {
    const wallet = new FakeWallet();
    wallet.seedAccount("GBXK1234567890ABCD7Q2M");
    renderReview({ wallet, gateway: null });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El servicio de solicitudes no está disponible en esta demostración. No se envió nada."
    );
  });
});
