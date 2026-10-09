import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportExport } from "./report-export";

describe("ReportExport", () => {
  it("renders a disabled control with a visible reason when no mechanism is wired", () => {
    render(<ReportExport />);

    const button = screen.getByRole("button", { name: "Exportar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-describedby");
  });

  it("invokes the wired export handler when available", () => {
    const onExport = vi.fn();
    render(<ReportExport onExport={onExport} />);

    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
