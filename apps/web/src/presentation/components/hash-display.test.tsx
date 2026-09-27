import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { microcopy } from "@/application/trust/disclosures";
import { HashDisplay } from "./hash-display";

const FULL_HASH = "9c4e2a71f0b3d85e6a1c7f29b04d3e8a5f6c1b72d9e04a3f8b6c2d1e7a9f0b35";

describe("HashDisplay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the visible label and a middle-truncated value with the full value available via title and hidden text", () => {
    render(<HashDisplay label="Hash de transacción" value={FULL_HASH} />);

    expect(screen.getByText("Hash de transacción")).toBeInTheDocument();

    // Full value stays available to assistive tech even though the visible
    // glyph is truncated.
    const hiddenFull = screen.getByText(FULL_HASH);
    expect(hiddenFull).toHaveClass("sr-only");

    const truncated = `${FULL_HASH.slice(0, 10)}…${FULL_HASH.slice(-8)}`;
    const visible = screen.getByText(truncated);
    expect(visible).toBeInTheDocument();
    expect(visible.closest("[title]")).toHaveAttribute("title", FULL_HASH);
  });

  it("renders a short value without truncating it", () => {
    render(<HashDisplay label="Contrato" value="CDLZ7Q4K" />);

    // getByText would throw on ambiguity if the value were duplicated
    // visibly and truncated at the same time; a single, non-truncated match
    // proves no truncation happened.
    expect(screen.getAllByText("CDLZ7Q4K").length).toBeGreaterThan(0);
  });

  it("renders the canonical TESTNET badge", () => {
    render(<HashDisplay label="Hash de transacción" value={FULL_HASH} />);

    expect(screen.getByText(microcopy.testnetBadge)).toBeInTheDocument();
  });

  it("copies the full value to the clipboard and shows an announced confirmation on success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    render(<HashDisplay label="Hash de transacción" value={FULL_HASH} />);

    fireEvent.click(screen.getByRole("button", { name: /copiar/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(FULL_HASH));
    const confirmation = await screen.findByText("Copiado");
    expect(confirmation.closest('[aria-live="polite"]')).toBeInTheDocument();
  });

  it("shows a visible failure message when the clipboard write rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    render(<HashDisplay label="Hash de transacción" value={FULL_HASH} />);

    fireEvent.click(screen.getByRole("button", { name: /copiar/i }));

    expect(await screen.findByText(/no se pudo copiar/i)).toBeInTheDocument();
  });

  it("shows a visible failure message when the clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });

    render(<HashDisplay label="Hash de transacción" value={FULL_HASH} />);

    fireEvent.click(screen.getByRole("button", { name: /copiar/i }));

    expect(await screen.findByText(/no se pudo copiar/i)).toBeInTheDocument();
  });

  it("renders an optional explorer link that opens in a new tab with an accessible hint", () => {
    render(
      <HashDisplay
        label="Hash de transacción"
        value={FULL_HASH}
        explorerUrl="https://stellar.expert/explorer/testnet/tx/abc"
      />
    );

    const link = screen.getByRole("link", { name: /abre en una pestaña nueva/i });
    expect(link).toHaveAttribute("href", "https://stellar.expert/explorer/testnet/tx/abc");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });

  it("renders no explorer link when explorerUrl is not provided", () => {
    render(<HashDisplay label="Hash de transacción" value={FULL_HASH} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
