import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiEvaluationInput } from "@/application/ports/ai-evaluation-port";
import type { CompletenessCheckInput } from "@/application/ports/completeness-check-port";
import { FakeAiEvaluation } from "@/test/fake-ai-evaluation";
import { FakeCompleteness, completenessResult, gapFinding } from "@/test/fake-completeness";
import { AiStep } from "./ai-step";
import { CompletenessFindings } from "./completeness-findings";

const INPUT: AiEvaluationInput = { smeReference: "30712345678", sales: [] };
const CINPUT: CompletenessCheckInput = {
  documents: [
    { kind: "sales-declarations", present: true },
    { kind: "cuit", present: true },
    { kind: "articles-of-incorporation", present: false }
  ],
  photoCount: 0,
  salesMonths: [{ month: "Abril", valueArs: null }]
};

function step(port: FakeAiEvaluation, completeness: FakeCompleteness, onContinue = vi.fn()) {
  render(
    <AiStep
      port={port}
      input={INPUT}
      completenessPort={completeness}
      completenessInput={CINPUT}
      onContinue={onContinue}
      onCorrect={vi.fn()}
    />
  );
}

function completenessSection(): HTMLElement {
  const section = screen.getByRole("heading", { name: "Información completa" }).closest("section");
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

afterEach(() => cleanup());

describe("[verifier probes #536]", () => {
  it("[V-B1] completeness loading line carries a visible animate-spin, aria-hidden spinner; exactly one status while the band is busy", async () => {
    const port = new FakeAiEvaluation();
    const relE = port.holdNextEvaluate();
    const c = new FakeCompleteness();
    const relC = c.holdNextCheck();
    step(port, c);

    // exactly the band's own live region; completeness adds none
    expect(screen.getAllByRole("status")).toHaveLength(1);
    const section = completenessSection();
    expect(within(section).queryByRole("status")).toBeNull();

    const line = within(section).getByText("Revisando faltantes y anomalías…").closest("p") as HTMLElement;
    expect(line).not.toBeNull();
    expect(line).toHaveAttribute("aria-busy", "true");
    expect(line.hasAttribute("hidden")).toBe(false);
    const svg = line.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveClass("animate-spin");
    expect(svg).toHaveAttribute("aria-hidden", "true");

    await act(async () => {
      relC();
    });
    await act(async () => {
      relE();
    });
  });

  it("[V-B1] after the band resolves the spinner stays and there is NO status at all (no second live region)", async () => {
    const port = new FakeAiEvaluation();
    const c = new FakeCompleteness();
    const relC = c.holdNextCheck();
    step(port, c);

    expect(await screen.findByText("Riesgo medio")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    const section = completenessSection();
    const line = within(section).getByText("Revisando faltantes y anomalías…").closest("p") as HTMLElement;
    expect(line.querySelector("svg")).toHaveClass("animate-spin");
    expect(line.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    await act(async () => {
      relC();
    });
  });

  it("[V-B2] band done + check pending: BOTH actions absent; both appear enabled once it settles", async () => {
    const port = new FakeAiEvaluation();
    const c = new FakeCompleteness();
    const relC = c.holdNextCheck();
    step(port, c);

    expect(await screen.findByText("Riesgo medio")).toBeInTheDocument();
    expect(screen.getByText("Revisando faltantes y anomalías…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continuar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Corregir datos/ })).toBeNull();

    await act(async () => {
      relC();
    });

    expect(screen.getByRole("button", { name: /Continuar/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Corregir datos/ })).toBeEnabled();
  });

  it("[V-B2] a failed check counts as settled and reveals the actions", async () => {
    const port = new FakeAiEvaluation();
    const c = new FakeCompleteness();
    c.failNext("unavailable");
    step(port, c);

    expect(await screen.findByText("Riesgo medio")).toBeInTheDocument();
    expect(await screen.findByText(/No pudimos revisar la información/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Corregir datos/ })).toBeEnabled();
  });

  it("[V-B2] a never-resolving check keeps BOTH actions absent even after the band lands", async () => {
    const port = new FakeAiEvaluation();
    const c = new FakeCompleteness();
    c.holdNextCheck(); // never released
    step(port, c);

    expect(await screen.findByText("Riesgo medio")).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByRole("button", { name: /Continuar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Corregir datos/ })).toBeNull();
  });

  it("[V-I1] an INCOMPLETE settled result keeps Continuar present + enabled and shows the warn notice", async () => {
    const c = new FakeCompleteness();
    c.seedResult({ complete: false, findings: [gapFinding()] });
    const onContinue = vi.fn();
    step(new FakeAiEvaluation(), c, onContinue);

    expect(await screen.findByText(/Podés enviar la solicitud igual/)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Continuar/ });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("[V-I1] a COMPLETE result with warnings also keeps Continuar present + enabled", async () => {
    const c = new FakeCompleteness();
    c.seedResult({
      complete: true,
      findings: [{ code: "sales_anomaly", severity: "warning", detail: "Las ventas de Agosto son altas." }]
    });
    step(new FakeAiEvaluation(), c);

    expect(await screen.findByText("Las ventas de Agosto son altas.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeEnabled();
  });

  it("[V-I2] once the band resolves and the check settles, exactly zero status in the whole step", async () => {
    const c = new FakeCompleteness();
    c.seedResult(completenessResult());
    step(new FakeAiEvaluation(), c);

    expect(await screen.findByText("No encontramos faltantes ni anomalías.")).toBeInTheDocument();
    expect(screen.queryAllByRole("status")).toHaveLength(0);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("[V-I3] onSettled omitted: CompletenessFindings still renders loading then findings (backward-compatible)", async () => {
    const c = new FakeCompleteness();
    c.seedResult(completenessResult());
    render(<CompletenessFindings port={c} input={CINPUT} />);

    expect(screen.getByText("Revisando faltantes y anomalías…")).toBeInTheDocument();
    expect(await screen.findByText("No encontramos faltantes ni anomalías.")).toBeInTheDocument();
  });

  it("[V-I3] onSettled fires exactly once, not per render, and the check runs once for a stable (port,input)", async () => {
    const c = new FakeCompleteness();
    const onSettled = vi.fn();
    const { rerender } = render(
      <CompletenessFindings port={c} input={CINPUT} onSettled={onSettled} />
    );
    await act(async () => {});
    rerender(<CompletenessFindings port={c} input={CINPUT} onSettled={() => onSettled()} />);
    rerender(<CompletenessFindings port={c} input={CINPUT} onSettled={() => onSettled()} />);
    await act(async () => {});

    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(c.calls).toHaveLength(1);
  });

  it("[V-I3] onSettled fires exactly once under React StrictMode double-invocation", async () => {
    const c = new FakeCompleteness();
    const onSettled = vi.fn();
    render(
      <StrictMode>
        <CompletenessFindings port={c} input={CINPUT} onSettled={onSettled} />
      </StrictMode>
    );
    await act(async () => {});
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("[V-I3] AiStep under StrictMode still reveals the actions once the check settles", async () => {
    const port = new FakeAiEvaluation();
    const c = new FakeCompleteness();
    render(
      <StrictMode>
        <AiStep
          port={port}
          input={INPUT}
          completenessPort={c}
          completenessInput={CINPUT}
          onContinue={vi.fn()}
          onCorrect={vi.fn()}
        />
      </StrictMode>
    );
    expect(await screen.findByRole("button", { name: /Continuar/ })).toBeEnabled();
  });
});
