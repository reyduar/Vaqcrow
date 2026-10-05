import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AiEvaluationInput } from "@/application/ports/ai-evaluation-port";
import type { CompletenessCheckInput } from "@/application/ports/completeness-check-port";
import { FakeAiEvaluation } from "@/test/fake-ai-evaluation";
import { FakeCompleteness, completenessResult, gapFinding } from "@/test/fake-completeness";
import { AiStep } from "./ai-step";

const INPUT: AiEvaluationInput = { smeReference: "30712345678", sales: [] };

const COMPLETENESS_INPUT: CompletenessCheckInput = {
  documents: [
    { kind: "sales-declarations", present: true },
    { kind: "cuit", present: true },
    { kind: "articles-of-incorporation", present: false }
  ],
  photoCount: 0,
  salesMonths: [{ month: "Abril", valueArs: null }]
};

function renderStep(port = new FakeAiEvaluation(), completeness = new FakeCompleteness()) {
  const onContinue = vi.fn();
  const onCorrect = vi.fn();
  render(
    <AiStep
      port={port}
      input={INPUT}
      completenessPort={completeness}
      completenessInput={COMPLETENESS_INPUT}
      onContinue={onContinue}
      onCorrect={onCorrect}
    />
  );
  return { port, completeness, onContinue, onCorrect };
}

describe("AiStep", () => {
  it("shows the busy status while the evaluation runs, with no action buttons yet", async () => {
    const port = new FakeAiEvaluation();
    const release = port.holdNextEvaluate();
    renderStep(port);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Analizando tu solicitud…");
    expect(status).toHaveTextContent("Revisando KYC, ventas declaradas y archivos adjuntos.");
    expect(screen.queryByRole("button", { name: /Continuar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Corregir datos/ })).not.toBeInTheDocument();
    expect(port.calls).toEqual([INPUT]);

    await act(async () => {
      release();
    });
  });

  it("renders the heading, the SIMULADO marker and the subtitle", () => {
    const port = new FakeAiEvaluation();
    port.holdNextEvaluate();
    renderStep(port);

    expect(screen.getByRole("heading", { level: 1, name: "Evaluación AI" })).toBeInTheDocument();
    expect(screen.getAllByText("SIMULADO").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(
        "La IA ordena la evidencia que cargaste, marca faltantes y anomalías y propone una banda de riesgo. No aprueba ni rechaza: la decisión la toma una persona en el paso siguiente."
      )
    ).toBeInTheDocument();
  });

  it("renders the risk band and the API completeness findings when done", async () => {
    const port = new FakeAiEvaluation();
    const completeness = new FakeCompleteness();
    completeness.seedResult({
      complete: false,
      findings: [gapFinding("Falta un documento obligatorio: Estatuto.")]
    });
    const release = port.holdNextEvaluate();
    renderStep(port, completeness);

    await act(async () => {
      release();
    });

    expect(await screen.findByText("Banda de riesgo propuesta")).toBeInTheDocument();
    expect(screen.getByText("Sujeta a revisión humana")).toBeInTheDocument();
    expect(screen.getByText("Riesgo medio")).toBeInTheDocument();

    expect(screen.getByText("Completitud de la solicitud")).toBeInTheDocument();
    expect(screen.getByText("Falta un documento obligatorio: Estatuto.")).toBeInTheDocument();
    expect(screen.getByText("Faltante:")).toBeInTheDocument();
    expect(completeness.calls).toEqual([COMPLETENESS_INPUT]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("warns without blocking when the result is incomplete", async () => {
    const completeness = new FakeCompleteness();
    completeness.seedResult({ complete: false, findings: [gapFinding()] });
    const { onContinue } = renderStep(new FakeAiEvaluation(), completeness);

    expect(await screen.findByText(/Podés enviar la solicitud igual/)).toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: /Continuar/ });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("does not warn when the application is complete", async () => {
    const completeness = new FakeCompleteness();
    completeness.seedResult(completenessResult());
    renderStep(new FakeAiEvaluation(), completeness);

    expect(await screen.findByText("Completitud de la solicitud")).toBeInTheDocument();
    expect(screen.queryByText(/Podés enviar la solicitud igual/)).not.toBeInTheDocument();
    expect(screen.getByText(/No encontramos faltantes ni anomalías/)).toBeInTheDocument();
  });

  it("keeps Continuar available when the completeness check fails", async () => {
    const completeness = new FakeCompleteness();
    completeness.failNext("network");
    const { onContinue } = renderStep(new FakeAiEvaluation(), completeness);

    expect(await screen.findByText(/No pudimos revisar la completitud/)).toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: /Continuar/ });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("advances with Continuar and returns with Corregir datos", async () => {
    const { onContinue, onCorrect } = renderStep();

    fireEvent.click(await screen.findByRole("button", { name: /Continuar/ }));
    expect(onContinue).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Corregir datos/ }));
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failure with a working retry instead of a dead end", async () => {
    const port = new FakeAiEvaluation();
    port.failNext();
    renderStep(port);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos completar la evaluación. Probá de nuevo.");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    });

    expect(await screen.findByText("Riesgo medio")).toBeInTheDocument();
    expect(port.calls).toHaveLength(2);
  });
});
