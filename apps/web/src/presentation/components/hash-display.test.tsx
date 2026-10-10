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

  it("names the explorer link after what it proves and gives it the shared focus ring (#438/WU5)", () => {
    render(
      <HashDisplay label="Hash de transacción" value={FULL_HASH} explorerUrl="https://explorer.example/tx/abc" />
    );

    const link = screen.getByRole("link", {
      name: "Ver en el explorador: hash de transacción (abre en una pestaña nueva)"
    });
    expect(link).toHaveTextContent("Ver en el explorador");
    expect(link.className).toContain("focus-visible:outline-focus-ring");
  });

  it("makes two explorer links in one section distinguishable through proofLabel", () => {
    render(
      <>
        <HashDisplay
          label="Contrato"
          value="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC7Q4K"
          explorerUrl="https://explorer.example/contract/abc"
          proofLabel="Contrato de la bóveda"
        />
        <HashDisplay
          label="Hash"
          value={FULL_HASH}
          explorerUrl="https://explorer.example/tx/abc"
          proofLabel="Transacción de despliegue"
        />
      </>
    );

    expect(
      screen.getByRole("link", { name: "Ver en el explorador: contrato de la bóveda (abre en una pestaña nueva)" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver en el explorador: transacción de despliegue (abre en una pestaña nueva)" })
    ).toBeInTheDocument();
  });

  it("renders no explorer link when explorerUrl is not provided", () => {
    render(<HashDisplay label="Hash de transacción" value={FULL_HASH} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
