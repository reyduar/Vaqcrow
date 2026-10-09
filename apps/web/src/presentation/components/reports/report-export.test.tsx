import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportExport } from "./report-export";

describe("ReportExport", () => {
  it("offers a CSV download and a print action inside the named Exportar group", () => {
    render(<ReportExport onDownloadCsv={vi.fn()} onPrint={vi.fn()} />);

    expect(screen.getByRole("group", { name: "Exportar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Descargar CSV/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Imprimir \/ PDF/ })).toBeEnabled();
  });

  it("invokes the wired handlers when each action is pressed", () => {
    const onDownloadCsv = vi.fn();
    const onPrint = vi.fn();
    render(<ReportExport onDownloadCsv={onDownloadCsv} onPrint={onPrint} />);

    fireEvent.click(screen.getByRole("button", { name: /Descargar CSV/ }));
    fireEvent.click(screen.getByRole("button", { name: /Imprimir \/ PDF/ }));

    expect(onDownloadCsv).toHaveBeenCalledTimes(1);
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it("disables both actions while the report is loading", () => {
    render(<ReportExport onDownloadCsv={vi.fn()} onPrint={vi.fn()} isLoading />);

    expect(screen.getByRole("button", { name: /Preparando…/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Imprimir \/ PDF/ })).toBeDisabled();
  });
});
