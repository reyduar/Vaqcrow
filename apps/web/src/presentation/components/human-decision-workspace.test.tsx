import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HumanDecisionGateway } from "@/application/ports/human-decision-gateway";
import { HumanDecisionWorkspace } from "./human-decision-workspace";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recordOf = (decisionId: string) => ({
  decisionId,
  applicationId: APPLICATION_ID,
  outcome: "rejected",
  actor: "operador-demo (simulado)",
  reason: "Documentación insuficiente",
  approvedLimitArs: null,
  decidedAt: "2026-09-19T12:00:00.000Z",
  correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
});

function fillAndSubmit() {
  fireEvent.click(screen.getByRole("radio", { name: /Rechazar/ }));
  fireEvent.change(screen.getByLabelText(/Razón/), { target: { value: "Documentación insuficiente" } });
  fireEvent.click(screen.getByRole("button", { name: /Registrar decisión/ }));
}

describe("HumanDecisionWorkspace", () => {
  it("shows the AI recommendation apart from the human decision form", () => {
    render(<HumanDecisionWorkspace gateway={null} applicationId={APPLICATION_ID} />);

    const recommendation = screen.getByRole("region", { name: /Recomendación de IA/ });
    const decision = screen.getByRole("form", { name: /Decisión humana/ });
    expect(recommendation.contains(decision)).toBe(false);
    expect(recommendation).toHaveTextContent("SIMULADO");
  });

  it("records a decision through the gateway and shows the server record instead of the form", async () => {
    const gateway: HumanDecisionGateway = {
      record: vi.fn().mockImplementation((command) =>
        Promise.resolve({ applied: true, decision: recordOf(command.decisionId) })
      )
    };
    render(<HumanDecisionWorkspace gateway={gateway} applicationId={APPLICATION_ID} />);

    fillAndSubmit();

    expect(await screen.findByRole("status")).toHaveTextContent(/decisión humana registrada/i);
    expect(screen.queryByRole("form", { name: /Decisión humana/ })).not.toBeInTheDocument();
    expect(gateway.record).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: APPLICATION_ID, outcome: "rejected", approvedLimitArs: null })
    );
  });

  it("does not claim success when the backend reports a state conflict", async () => {
    const gateway: HumanDecisionGateway = {
      record: vi.fn().mockRejectedValue(new HttpClientError("http", 409, undefined, "state_conflict"))
    };
    render(<HumanDecisionWorkspace gateway={gateway} applicationId={APPLICATION_ID} />);

    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya no está pendiente/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("form", { name: /Decisión humana/ })).toBeInTheDocument();
  });

  it("retries the same payload with the same decision id after a network failure", async () => {
    const record = vi
      .fn()
      .mockRejectedValueOnce(new HttpClientError("network"))
      .mockImplementationOnce((command) => Promise.resolve({ applied: false, decision: recordOf(command.decisionId) }));
    render(<HumanDecisionWorkspace gateway={{ record }} applicationId={APPLICATION_ID} />);

    fillAndSubmit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo confirmar/i);

    fireEvent.click(screen.getByRole("button", { name: /Registrar decisión/ }));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(2));

    expect(record.mock.calls[1]![0].decisionId).toBe(record.mock.calls[0]![0].decisionId);
    expect(await screen.findByText(/ya estaba registrada/i)).toBeInTheDocument();
  });

  it("fails explicitly when no backend is configured", async () => {
    render(<HumanDecisionWorkspace gateway={null} applicationId={APPLICATION_ID} />);

    fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no está disponible/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
