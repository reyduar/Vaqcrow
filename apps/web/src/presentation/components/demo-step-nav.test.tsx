import { render as rtlRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { DemoStep } from "@/application/navigation/demo-steps";
import { JourneyStoreProvider } from "@/state/journey-store-provider";
import { DemoStepNav } from "./demo-step-nav";

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: JourneyStoreProvider });

const previousStep: DemoStep = { slug: "request", label: "Solicitud" };
const nextStep: DemoStep = { slug: "approval", label: "Aprobación" };

describe("DemoStepNav", () => {
  it("renders both previous and next links when both are present", () => {
    render(<DemoStepNav previous={previousStep} next={nextStep} />);

    expect(screen.getByRole("link", { name: /solicitud/i })).toHaveAttribute("href", "/request");
    expect(screen.getByRole("link", { name: /aprobación/i })).toHaveAttribute("href", "/approval");
  });

  it("omits the previous link on the first step", () => {
    render(<DemoStepNav previous={null} next={nextStep} />);

    expect(screen.queryByRole("link", { name: /solicitud/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /aprobación/i })).toBeInTheDocument();
  });

  it("omits the next link on the last step", () => {
    render(<DemoStepNav previous={previousStep} next={null} />);

    expect(screen.queryByRole("link", { name: /aprobación/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /solicitud/i })).toBeInTheDocument();
  });
  it("appends the journey identifiers held by the store to both links", () => {
    const app = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
    rtlRender(
      <JourneyStoreProvider initial={{ applicationId: app }}>
        <DemoStepNav previous={previousStep} next={nextStep} />
      </JourneyStoreProvider>
    );

    expect(screen.getByRole("link", { name: /solicitud/i })).toHaveAttribute("href", `/request?application=${app}`);
    expect(screen.getByRole("link", { name: /aprobación/i })).toHaveAttribute("href", `/approval?application=${app}`);
  });
});
