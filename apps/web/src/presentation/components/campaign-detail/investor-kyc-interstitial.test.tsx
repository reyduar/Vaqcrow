import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvestorKycInterstitial } from "./investor-kyc-interstitial";

/**
 * The investor's one-shot simulated-KYC interstitial (Feature #422, WU4). It is
 * labelled `SIMULADO`, says plainly that no real verification happens, and every
 * action is a prop.
 */
function renderInterstitial(overrides: Partial<Parameters<typeof InvestorKycInterstitial>[0]> = {}) {
  const props = {
    isOpen: true,
    isApproving: false,
    failed: false,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
  const view = render(<InvestorKycInterstitial {...props} />);
  return { ...props, view };
}

describe("InvestorKycInterstitial", () => {
  it("labels itself SIMULADO and states it is not a real verification", () => {
    renderInterstitial();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Verificación de identidad")).toBeInTheDocument();
    expect(within(dialog).getByText("SIMULADO")).toBeInTheDocument();
    expect(within(dialog).getByText("No es una verificación real")).toBeInTheDocument();
  });

  it("confirms through onConfirm", () => {
    const { onConfirm } = renderInterstitial();

    fireEvent.click(screen.getByRole("button", { name: "Aprobar y continuar" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("keeps an honest retry visible when the approval failed", () => {
    renderInterstitial({ failed: true });

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos registrar la verificación simulada. Reintentá.");
  });

  it("renders nothing while closed", () => {
    renderInterstitial({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
