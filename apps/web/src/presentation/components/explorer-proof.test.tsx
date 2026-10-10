import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExplorerProof } from "./explorer-proof";

const HASH = "9c4e2a71f0b3d85e6a1c7f29b04d3e8a5f6c1b72d9e04a3f8b6c2d1e7a9f0b35";
const URL = `https://explorer.example/tx/${HASH}`;

describe("ExplorerProof", () => {
  it("renders the label and the middle-truncated value, keeping the full value for assistive tech", () => {
    render(<ExplorerProof label="Hash de la transacción" value={HASH} explorerUrl={null} />);

    expect(screen.getByText("Hash de la transacción")).toBeInTheDocument();
    expect(screen.getByText(`${HASH.slice(0, 10)}…${HASH.slice(-8)}`)).toBeInTheDocument();
    expect(screen.getByText(HASH)).toHaveClass("sr-only");
    expect(screen.getByTitle(HASH)).toBeInTheDocument();
  });

  it("links to the API-supplied explorer URL in a new tab with a descriptive accessible name", () => {
    render(<ExplorerProof label="Hash de la transacción" value={HASH} explorerUrl={URL} />);

    const link = screen.getByRole("link", {
      name: `Ver hash de la transacción ${HASH} en el explorador (abre en una pestaña nueva)`
    });
    expect(link).toHaveAttribute("href", URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
    expect(link).toHaveTextContent("Ver en el explorador");
    expect(link.className).toContain("focus-visible:outline-focus-ring");
  });

  it("renders the hash without a link when the explorer URL is null", () => {
    render(<ExplorerProof label="Hash de la transacción" value={HASH} explorerUrl={null} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders «Sin dato» (never a zero) and no link when the value is unknown", () => {
    render(<ExplorerProof label="Hash del aporte" value={null} explorerUrl={URL} />);

    expect(screen.getByText("Sin dato")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("accepts a custom missing node, link text and proof label", () => {
    render(
      <>
        <ExplorerProof label="Hash" value={null} explorerUrl={null} missing={<span>Evidencia faltante</span>} />
        <ExplorerProof
          label="Bóveda"
          value="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2"
          explorerUrl="https://explorer.example/contract/CDLZ"
          linkText="Ver bóveda en el explorador"
          proofLabel="Bóveda de Panadería"
        />
      </>
    );

    expect(screen.getByText("Evidencia faltante")).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: "Ver bóveda de Panadería CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2 en el explorador (abre en una pestaña nueva)"
    });
    expect(link).toHaveTextContent("Ver bóveda en el explorador");
  });

  it("shows a caller-shortened value (the template's «CDLZ…7Q4K») while keeping the full value for assistive tech", () => {
    const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";
    render(<ExplorerProof label="Bóveda" value={VAULT} displayValue="CDLZ…N4B2" explorerUrl={null} />);

    expect(screen.getByText("CDLZ…N4B2")).toBeInTheDocument();
    expect(screen.getByText(VAULT)).toHaveClass("sr-only");
  });

  it("can hide its visible label when a surrounding term already names the value", () => {
    render(<ExplorerProof label="Bóveda" hideLabel value={HASH} explorerUrl={null} />);

    expect(screen.queryByText("Bóveda")).not.toBeInTheDocument();
  });
});
