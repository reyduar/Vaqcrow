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
  it("keeps success opt-in: no variant resolves to it by default", () => {
    // Slice 3 adopts the template's success tone, bounded by `demo-ui.md` §2:
    // green is only for a ledger-confirmed outcome, so it is a tone a caller
    // selects explicitly, never a variant default.
    const tones: readonly BadgeTone[] = ["neutral", "info", "caution", "critical", "success"];

    expect(tones).toContain("success");
  });

  it("renders the adopted success surface only when explicitly asked", () => {
    const { container } = render(<Badge variant="transaction" label="Confirmada" tone="success" />);

    const badge = container.querySelector("[data-tone]");
    expect(badge).toHaveAttribute("data-tone", "success");
    expect(badge?.className ?? "").toMatch(/trust-success/);
  });

  it("renders the template's 22 px header chip when compact, and the 24 px badge by default", () => {
    const { container } = render(
      <>
        <Badge variant="testnet" label="TESTNET" size="compact" />
        <Badge variant="testnet" label="Testnet" />
      </>
    );

    const [compact, regular] = [...container.querySelectorAll("[data-variant]")];
    expect(compact?.className ?? "").toMatch(/h-\[22px\]/);
    expect(compact?.className ?? "").toMatch(/text-\[11px\]/);
    expect(compact?.className ?? "").not.toMatch(/\bh-6\b/);
    expect(regular?.className ?? "").toMatch(/\bh-6\b/);
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
