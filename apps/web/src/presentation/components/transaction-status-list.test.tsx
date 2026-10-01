import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { microcopy } from "@/application/trust/disclosures";
import { TransactionStatusList, type TransactionStatusItem } from "./transaction-status-list";

const PROGRESSION: readonly TransactionStatusItem[] = [
  { state: "signed", detail: "14:02:11 · cuenta GBX4…Q7LM" },
  { state: "sent" },
  { state: "confirmed" }
];

describe("TransactionStatusList", () => {
  it("renders the signed → sent → confirmed progression as an ordered list", () => {
    render(<TransactionStatusList items={PROGRESSION} />);

    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Firmada en Freighter")).toBeInTheDocument();
    expect(screen.getByText("Enviada · pendiente de confirmación")).toBeInTheDocument();
    expect(screen.getByText("Confirmada en el ledger")).toBeInTheDocument();
  });

  it("announces list changes politely", () => {
    render(<TransactionStatusList items={PROGRESSION} />);

    expect(screen.getByRole("list")).toHaveAttribute("aria-live", "polite");
  });

  it("renders the canonical pending sentence verbatim for the sent state", () => {
    render(<TransactionStatusList items={PROGRESSION} />);

    const sentItem = screen.getAllByRole("listitem")[1]!;
    expect(within(sentItem).getByText(microcopy.submittedNotConfirmed)).toBeInTheDocument();
  });

  it("never treats the sent state as success", () => {
    render(<TransactionStatusList items={PROGRESSION} />);

    const sentItem = screen.getAllByRole("listitem")[1]!;
    expect(sentItem.className).not.toMatch(/trust-info/);
    expect(sentItem.className).not.toMatch(/success/);
  });

  it("uses the success tone only for the ledger-confirmed state, never for a pending one", () => {
    const { container } = render(<TransactionStatusList items={PROGRESSION} />);

    const sentItem = screen.getAllByRole("listitem")[1]!;
    expect(sentItem.className).not.toMatch(/trust-success/);

    const confirmedItem = screen.getAllByRole("listitem")[2]!;
    expect(confirmedItem.className).toMatch(/trust-success/);

    // Success is adopted (Slice 3) but bounded: exactly one surface may carry it.
    expect(container.querySelectorAll(".bg-trust-success-surface")).toHaveLength(1);
  });

  it("keeps every text run on the page foreground so it meets AA over the tint", () => {
    // The /10 state tints are near-white in light mode. Over them the state
    // colour as a text run measures 4.38:1 (caution) / 4.50:1 (info), and any
    // reduced opacity drops all four states to 3.19–4.11:1 — under the 4.5:1
    // AA floor for 13–14px text. So the tint, the border and the icon carry
    // the state colour, and no text run may recolour or fade itself.
    const { container } = render(<TransactionStatusList items={PROGRESSION} />);

    for (const element of container.querySelectorAll("*")) {
      expect(element.getAttribute("class") ?? "").not.toMatch(/(?:^|\s)opacity-\d/);
    }

    const sentItem = screen.getAllByRole("listitem")[1]!;
    expect(sentItem.className).not.toMatch(/text-trust-/);
    expect(within(sentItem).getByText("Enviada · pendiente de confirmación").className).not.toMatch(
      /text-trust-|text-muted/
    );
    const icon = sentItem.querySelector("svg");
    expect(icon?.getAttribute("class") ?? "").toMatch(/text-trust-caution/);
  });

  it("carries the confirmed state's success signal as an aria-hidden icon plus visible text", () => {
    render(<TransactionStatusList items={PROGRESSION} />);

    const confirmedItem = screen.getAllByRole("listitem")[2]!;
    expect(within(confirmedItem).getByText("Confirmada en el ledger")).toBeInTheDocument();
    const icon = confirmedItem.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    // The positive read is the success tone plus the text, never colour alone.
    expect(icon?.getAttribute("class") ?? "").toMatch(/text-trust-success/);
  });

  it("renders the failed state as a failure, never as success", () => {
    render(<TransactionStatusList items={[{ state: "failed", detail: "Saldo insuficiente" }]} />);

    const failedItem = screen.getByRole("listitem");
    expect(within(failedItem).getByText("Fallida")).toBeInTheDocument();
    expect(failedItem.className).toMatch(/trust-critical/);
    expect(failedItem.className).not.toMatch(/trust-info|success/);
    const icon = failedItem.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("defaults the heading to 'Estado de transacción' at level 3", () => {
    const { container } = render(<TransactionStatusList items={PROGRESSION} />);

    const heading = container.querySelector("h3");
    expect(heading).not.toBeNull();
    expect(heading).toHaveTextContent("Estado de transacción");
  });

  it("makes the heading level configurable", () => {
    const { container } = render(<TransactionStatusList items={PROGRESSION} headingLevel={2} />);

    expect(container.querySelector("h2")).toHaveTextContent("Estado de transacción");
    expect(container.querySelector("h3")).toBeNull();
  });

  it("renders the heading, subtitle and per-item detail when provided", () => {
    render(
      <TransactionStatusList
        items={PROGRESSION}
        heading="Estado de la operación"
        subtitle="Aporte a la bóveda · Stellar Testnet"
      />
    );

    expect(screen.getByRole("heading", { name: "Estado de la operación" })).toBeInTheDocument();
    expect(screen.getByText("Aporte a la bóveda · Stellar Testnet")).toBeInTheDocument();
    expect(screen.getByText("14:02:11 · cuenta GBX4…Q7LM")).toBeInTheDocument();
  });

  it("omits the subtitle and detail when not provided", () => {
    render(<TransactionStatusList items={[{ state: "signed" }]} />);

    expect(screen.queryByText("Aporte a la bóveda · Stellar Testnet")).not.toBeInTheDocument();
    expect(screen.queryByText("14:02:11 · cuenta GBX4…Q7LM")).not.toBeInTheDocument();
  });
});
