import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssessmentWorkspace } from "./assessment-workspace";
import type { AssessmentView } from "@/application/assessment/assessment-view";
import type { AssessmentGateway, AssessmentOutcome } from "@/application/ports/assessment-gateway";
import { HttpClientError } from "@/application/ports/http-client-port";
import { JourneyStoreProvider } from "@/state/journey-store-provider";

/**
 * The assessment step: ask the backend to assess the journey's application, then
 * show what came back — the recorded assessment, the manual-review routing, the
 * missing sales evidence — or say truthfully that nothing came back. With no
 * application in the journey it calls nothing and points at the request step.
 */

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

const VIEW: AssessmentView = {
  assessmentId: "asm_demo_001",
  riskBand: "medium",
  confidence: 0.72,
  reasons: [{ claim: "Las ventas son estacionales", evidenceRefs: ["sales:2026-01"] }],
  anomalies: [],
  missingData: [],
  recommendedAction: "human_review",
  questions: [],
  provenance: {
    model: "glm-5.3-flash",
    promptVersion: "assessment-v1",
    generatedAt: "2026-09-22T12:00:00.000Z",
    source: "provider"
  }
};

function gatewayReturning(outcome: AssessmentOutcome): AssessmentGateway {
  return { assess: vi.fn().mockResolvedValue(outcome), load: vi.fn() };
}

function gatewayRejecting(error: unknown): AssessmentGateway {
  return { assess: vi.fn().mockRejectedValue(error), load: vi.fn() };
}

function renderStep(gateway: AssessmentGateway | null, applicationId: string | null = APPLICATION_ID) {
  return render(
    <JourneyStoreProvider initial={{ applicationId }}>
      <AssessmentWorkspace gateway={gateway} />
    </JourneyStoreProvider>
  );
}

async function consult(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /consultar evaluación de IA/i }));
}

describe("AssessmentWorkspace", () => {
  it("says nothing was consulted until the operator asks", () => {
    renderStep(gatewayReturning({ kind: "recorded", view: VIEW }));

    expect(screen.getByText(/todavía no se consultó/i)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Evaluación de IA" })).not.toBeInTheDocument();
  });

  it("asks for the request first, and calls nothing, when the journey has no application", () => {
    const gateway = gatewayReturning({ kind: "recorded", view: VIEW });
    renderStep(gateway, null);

    expect(screen.getByRole("status")).toHaveTextContent(/primero hay que enviar la solicitud/i);
    expect(screen.getByRole("link", { name: /ir a la solicitud/i })).toHaveAttribute("href", "/request");
    expect(screen.queryByRole("button", { name: /consultar evaluación de IA/i })).not.toBeInTheDocument();
    expect(gateway.assess).not.toHaveBeenCalled();
  });

  it("assesses the journey's application and shows the recorded assessment", async () => {
    const gateway = gatewayReturning({ kind: "recorded", view: VIEW });
    renderStep(gateway);

    await consult();

    expect(await screen.findByRole("region", { name: "Evaluación de IA" })).toBeInTheDocument();
    expect(screen.getByText("glm-5.3-flash")).toBeInTheDocument();
    expect(gateway.assess).toHaveBeenCalledWith(APPLICATION_ID, expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(screen.getByRole("status")).toHaveTextContent(/pasó a revisión humana/i);
    // The standing fallback disclosure is always present; what must be absent on
    // a success is the failure alert, not the policy statement.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refuses to pretend when no backend is configured", async () => {
    renderStep(null);

    await consult();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no hay backend configurado/i);
    expect(screen.queryByRole("region", { name: "Evaluación de IA" })).not.toBeInTheDocument();
  });

  it("says the application went to human review WITHOUT an assessment when the AI failed", async () => {
    renderStep(gatewayReturning({ kind: "manual_review", failureCode: "timeout" }));

    await consult();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/no respondió a tiempo/i);
    expect(alert).toHaveTextContent(/pasó a revisión humana sin una evaluación de IA/i);
    expect(screen.queryByRole("region", { name: "Evaluación de IA" })).not.toBeInTheDocument();
    // The fallback banner belongs to the failure state, not to a success. It
    // renders twice — the banner title and its badge — so count rather than get.
    expect(screen.getAllByText(/respuesta de respaldo/i).length).toBeGreaterThan(0);
  });

  it("distinguishes an inadmissible answer from an outage", async () => {
    renderStep(gatewayReturning({ kind: "manual_review", failureCode: "invalid_output" }));

    await consult();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no cumple el contrato/i);
  });

  it("reports a missing sales series as nothing evaluated, not as a failed evaluation", async () => {
    renderStep(gatewayReturning({ kind: "sales_evidence_missing" }));

    await consult();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/no tiene historial de ventas/i);
    expect(alert).toHaveTextContent(/no se evaluó nada/i);
    // Nothing was routed anywhere: the copy must not claim a human review.
    expect(alert).not.toHaveTextContent(/pasó a revisión humana/i);
    expect(screen.queryByRole("region", { name: "Evaluación de IA" })).not.toBeInTheDocument();
  });

  it.each([
    [new HttpClientError("http", 404, undefined, "not_found"), /no se encontró la solicitud/i],
    [new HttpClientError("http", 409, undefined, "state_conflict"), /ya no está esperando evaluación/i],
    [new HttpClientError("http", 409, undefined, "correlation_conflict"), /otro intento de evaluación/i],
    [new HttpClientError("http", 503, undefined, "unavailable"), /la consulta falló/i]
  ])("explains a backend failure (%#) without claiming a routing", async (error, copy) => {
    renderStep(gatewayRejecting(error));

    await consult();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy);
    expect(alert).toHaveTextContent(/no hay evaluación que mostrar/i);
    expect(alert).not.toHaveTextContent(/pasó a revisión humana/i);
  });

  it("treats a drifted response as no assessment at all", async () => {
    renderStep(gatewayRejecting(new TypeError("drifted")));

    await consult();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no tiene la forma/i);
  });
});
