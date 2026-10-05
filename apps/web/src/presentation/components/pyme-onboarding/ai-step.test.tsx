import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("shows the completeness loading copy while the check is in flight, then the resolved result", async () => {
    const port = new FakeAiEvaluation();
    const releaseEvaluation = port.holdNextEvaluate();
    const completeness = new FakeCompleteness();
    completeness.seedResult(completenessResult());
    const releaseCheck = completeness.holdNextCheck();
    renderStep(port, completeness);

    expect(screen.getByText("Revisando faltantes y anomalías…")).toBeInTheDocument();
    expect(screen.queryByText("No encontramos faltantes ni anomalías.")).not.toBeInTheDocument();
    expect(completeness.calls).toEqual([COMPLETENESS_INPUT]);

    await act(async () => {
      releaseCheck();
    });

    expect(await screen.findByText("No encontramos faltantes ni anomalías.")).toBeInTheDocument();
    expect(screen.queryByText("Revisando faltantes y anomalías…")).not.toBeInTheDocument();

    await act(async () => {
      releaseEvaluation();
    });
  });

  it("renders the heading and the subtitle, with no simulated marker before the band lands", () => {
    const port = new FakeAiEvaluation();
    port.holdNextEvaluate();
    renderStep(port);

    expect(screen.getByRole("heading", { level: 1, name: "Evaluación AI" })).toBeInTheDocument();
    expect(screen.queryByText("SIMULADO")).not.toBeInTheDocument();
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
    expect(screen.getByText("SIMULADO")).toBeInTheDocument();

    expect(screen.getByText("Información completa")).toBeInTheDocument();
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

    expect(await screen.findByText("Información completa")).toBeInTheDocument();
    expect(screen.queryByText(/Podés enviar la solicitud igual/)).not.toBeInTheDocument();
    expect(screen.getByText(/No encontramos faltantes ni anomalías/)).toBeInTheDocument();
  });

  it("lists every API finding detail with its label in the findings section, without a simulated marker", async () => {
    const completeness = new FakeCompleteness();
    completeness.seedResult({
      complete: true,
      findings: [
        {
          code: "sales_anomaly",
          severity: "warning",
          detail: "Las ventas de Agosto superan ampliamente el promedio declarado."
        },
        {
          code: "insufficient_photos",
          severity: "warning",
          detail: "Subiste 5 fotos: el máximo sugerido es 4."
        }
      ]
    });
    const { onContinue } = renderStep(new FakeAiEvaluation(), completeness);

    const heading = await screen.findByRole("heading", { name: "Información completa" });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    const findings = within(section as HTMLElement);

    expect(findings.queryAllByText("SIMULADO")).toHaveLength(0);
    expect(
      findings.getByText("Las ventas de Agosto superan ampliamente el promedio declarado.")
    ).toBeInTheDocument();
    expect(findings.getByText("Subiste 5 fotos: el máximo sugerido es 4.")).toBeInTheDocument();
    expect(findings.getByText("Anomalía:")).toBeInTheDocument();
    expect(findings.getByText("Aviso:")).toBeInTheDocument();
    expect(screen.queryByText(/Podés enviar la solicitud igual/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeEnabled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("renders the content-relevance findings with visible labels and keeps Continuar available", async () => {
    const completeness = new FakeCompleteness();
    completeness.seedResult({
      complete: false,
      findings: [
        {
          code: "content_irrelevant",
          severity: "gap",
          detail: "El contenido de «Constancia de CUIT» no parece corresponder a ese documento."
        },
        {
          code: "content_unverified",
          severity: "warning",
          detail: "No pudimos verificar el contenido de «Foto del negocio»."
        }
      ]
    });
    const { onContinue } = renderStep(new FakeAiEvaluation(), completeness);

    const heading = await screen.findByRole("heading", { name: "Información completa" });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    const findings = within(section as HTMLElement);

    expect(
      findings.getByText("El contenido de «Constancia de CUIT» no parece corresponder a ese documento.")
    ).toBeInTheDocument();
    expect(findings.getByText("No pudimos verificar el contenido de «Foto del negocio».")).toBeInTheDocument();
    expect(findings.getByText("Faltante:")).toBeInTheDocument();
    expect(findings.getByText("Aviso:")).toBeInTheDocument();

    // A content gap warns; it never blocks the send (owner decision D2).
    const continueButton = screen.getByRole("button", { name: /Continuar/ });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("keeps Continuar available when the completeness check fails", async () => {
    const completeness = new FakeCompleteness();
    completeness.failNext("network");
    const { onContinue } = renderStep(new FakeAiEvaluation(), completeness);

    expect(await screen.findByText(/No pudimos revisar la información/)).toBeInTheDocument();
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
