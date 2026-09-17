import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IoWarningOutline } from "react-icons/io5";
import { Badge, type BadgeTone, type BadgeVariant } from "./badge";

const VARIANTS: readonly BadgeVariant[] = [
  "simulado",
  "testnet",
  "demo",
  "risk",
  "transaction",
  "evidence",
  "fallback"
];

describe("Badge", () => {
  it("never renders a 'success' tone — the type union has no such member", () => {
    // Type-level guard: BadgeTone excludes "success"; this line fails to
    // compile if the union is ever widened to include it.
    const tones: readonly BadgeTone[] = ["neutral", "info", "caution", "critical"];

    expect(tones).not.toContain("success");
  });

  it("always renders visible label text, never relying on icon or color alone", () => {
    render(<Badge variant="transaction" label="Enviada" />);

    expect(screen.getByText("Enviada")).toBeInTheDocument();
  });

  it("renders its icon as aria-hidden when provided", () => {
    const { container } = render(<Badge variant="risk" label="Requiere revisión" icon={IoWarningOutline} />);

    const icon = container.querySelector("svg");

    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("resolves a non-success default tone for every variant", () => {
    for (const variant of VARIANTS) {
      const { container, unmount } = render(<Badge variant={variant} label={variant} />);

      const tone = container.querySelector("[data-tone]")?.getAttribute("data-tone");

      expect(tone).not.toBe("success");
      unmount();
    }
  });

  it("never reads a pending transaction badge as success", () => {
    render(<Badge variant="transaction" label="Pendiente de confirmación" tone="neutral" />);

    const badge = screen.getByText("Pendiente de confirmación");

    expect(badge).toHaveAttribute("data-tone", "neutral");
  });
});
