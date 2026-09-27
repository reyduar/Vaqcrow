import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IoCubeOutline } from "react-icons/io5";
import { KpiTile } from "./kpi-tile";

describe("KpiTile", () => {
  it("associates the label and the value for assistive tech via dt/dd in one dl", () => {
    render(<KpiTile label="Fondeado" value="ARS 9.450.000" />);

    const dl = screen.getByText("Fondeado").closest("dl");
    expect(dl).not.toBeNull();
    const dt = dl?.querySelector("dt");
    const dd = dl?.querySelector("dd");
    expect(dt).toHaveTextContent("Fondeado");
    expect(dd).toHaveTextContent("ARS 9.450.000");
  });

  it("renders the value with tabular numerals", () => {
    render(<KpiTile label="Fondeado" value="ARS 9.450.000" />);

    const value = screen.getByText("ARS 9.450.000");
    expect(value.className).toContain("tabular-nums");
  });

  it("renders an optional note in a separate dd", () => {
    render(<KpiTile label="Fondeado" value="ARS 9.450.000" note="de ARS 15.000.000" />);

    expect(screen.getByText("de ARS 15.000.000")).toBeInTheDocument();
  });

  it("renders no note when omitted", () => {
    render(<KpiTile label="Fondeado" value="ARS 9.450.000" />);

    expect(screen.queryByText(/de ARS/)).not.toBeInTheDocument();
  });

  it("renders a decorative, aria-hidden icon when provided", () => {
    const { container } = render(<KpiTile label="Aportantes" value="38" icon={IoCubeOutline} />);

    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders no icon when omitted", () => {
    const { container } = render(<KpiTile label="Aportantes" value="38" />);

    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders a SIMULADO marker contiguous to the value when the value is synthetic", () => {
    render(<KpiTile label="Fondeado" value="ARS 9.450.000" simuladoLabel="SIMULADO" />);

    const value = screen.getByText("ARS 9.450.000");
    const badge = screen.getByText("SIMULADO");
    expect(value.parentElement).toContainElement(badge);
  });

  it("renders no SIMULADO marker when the value is not synthetic", () => {
    render(<KpiTile label="Fondeado" value="ARS 9.450.000" />);

    expect(screen.queryByText("SIMULADO")).not.toBeInTheDocument();
  });
});
