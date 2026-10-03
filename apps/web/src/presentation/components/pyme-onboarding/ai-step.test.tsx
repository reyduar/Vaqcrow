import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AiEvaluationInput } from "@/application/ports/ai-evaluation-port";
import { FakeAiEvaluation } from "@/test/fake-ai-evaluation";
import { AiStep } from "./ai-step";

const INPUT: AiEvaluationInput = { smeReference: "30712345678", sales: [] };

function renderStep(port = new FakeAiEvaluation()) {
  const onContinue = vi.fn();
  const onCorrect = vi.fn();
  render(<AiStep port={port} input={INPUT} onContinue={onContinue} onCorrect={onCorrect} />);
  return { port, onContinue, onCorrect };
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
    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
    expect(
      screen.getByText(
        "La IA ordena la evidencia que cargaste, marca faltantes y anomalías y propone una banda de riesgo. No aprueba ni rechaza: la decisión la toma una persona en el paso siguiente."
      )
    ).toBeInTheDocument();
  });

  it("renders the risk band as text and the four checks when done", async () => {
    const port = new FakeAiEvaluation();
    const release = port.holdNextEvaluate();
    renderStep(port);

    await act(async () => {
      release();
    });

    expect(await screen.findByText("Banda de riesgo propuesta")).toBeInTheDocument();
    expect(screen.getByText("Sujeta a revisión humana")).toBeInTheDocument();
    expect(screen.getByText("Riesgo medio")).toBeInTheDocument();

    expect(screen.getByText("Identidad y empresa")).toBeInTheDocument();
    expect(screen.getByText("Ventas declaradas")).toBeInTheDocument();
    expect(screen.getByText("Faltante")).toBeInTheDocument();
    expect(screen.getByText("Anomalía")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
