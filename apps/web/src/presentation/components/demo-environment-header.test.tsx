import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoEnvironmentHeader } from "./demo-environment-header";

describe("DemoEnvironmentHeader", () => {
  it("renders the brand plus the DEMO and TESTNET badges with visible text", () => {
    render(<DemoEnvironmentHeader />);

    expect(screen.getByText("Vaqcrow")).toBeInTheDocument();
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText("TESTNET · Activos sin valor económico")).toBeInTheDocument();
  });
});
