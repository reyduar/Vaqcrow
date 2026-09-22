import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssessmentWorkspace } from "./assessment-workspace";
import type { AssessmentView } from "@/application/assessment/assessment-view";
import type { AssessmentGateway } from "@/application/ports/assessment-gateway";
import { HttpClientError } from "@/application/ports/http-client-port";

/**
 * The assessment step: ask, then show what came back — or say truthfully that
 * nothing came back.
 */

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

function gatewayResolving(view: AssessmentView): AssessmentGateway {
  return { assess: async () => view };
}

function gatewayRejecting(error: unknown): AssessmentGateway {
  return {
    assess: async () => {
      throw error;
    }
  };
}

async function consult(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /consultar evaluación de IA/i }));
}

describe("AssessmentWorkspace", () => {
  it("says nothing was consulted until the operator asks", () => {
    render(<AssessmentWorkspace gateway={gatewayResolving(VIEW)} />);

    expect(screen.getByText(/todavía no se consultó/i)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Evaluación de IA" })).not.toBeInTheDocument();
  });

  it("shows the real assessment once it arrives", async () => {
    render(<AssessmentWorkspace gateway={gatewayResolving(VIEW)} />);

    await consult();

    expect(await screen.findByRole("region", { name: "Evaluación de IA" })).toBeInTheDocument();
    expect(screen.getByText("glm-5.3-flash")).toBeInTheDocument();
    // The standing fallback disclosure is always present; what must be absent on
    // a success is the failure alert, not the policy statement.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refuses to pretend when no backend is configured", async () => {
    render(<AssessmentWorkspace gateway={null} />);

    await consult();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no hay backend configurado/i);
    expect(screen.queryByRole("region", { name: "Evaluación de IA" })).not.toBeInTheDocument();
  });

  it("explains a provider timeout and keeps the decision with a person", async () => {
    render(
      <AssessmentWorkspace
        gateway={gatewayRejecting(new HttpClientError("http", 504, undefined, "timeout"))}
      />
    );

    await consult();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/no respondió a tiempo/i);
    expect(alert).toHaveTextContent(/revisión humana/i);
    // The fallback banner belongs to the failure state, not to a success. It
    // renders twice — the banner title and its badge — so count rather than get.
    expect(screen.getAllByText(/respuesta de respaldo/i).length).toBeGreaterThan(0);
  });

  it("distinguishes an inadmissible answer from an outage", async () => {
    render(
      <AssessmentWorkspace
        gateway={gatewayRejecting(new HttpClientError("http", 502, undefined, "invalid_output"))}
      />
    );

    await consult();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no cumple el contrato/i);
  });

  it("treats a drifted response as no assessment at all", async () => {
    render(<AssessmentWorkspace gateway={gatewayRejecting(new TypeError("drifted"))} />);

    await consult();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no tiene la forma/i);
  });
});
