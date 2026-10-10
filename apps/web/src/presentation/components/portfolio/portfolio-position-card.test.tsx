import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import { PortfolioPositionCard } from "./portfolio-position-card";

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    campaignId: CAMPAIGN_ID,
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    contributionXlm: "250.0000000",
    raisedArs: 9_450_000,
    goalArs: 15_000_000,
    fundedPercentBps: 6_300,
    status: "funding",
    closeDate: "2026-11-30T12:00:00.000Z",
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
    vaultExplorerUrl: null,
    transactions: [],
    ...overrides
  };
}

function renderCard(value: PortfolioPosition) {
  return render(
    <ul>
      <PortfolioPositionCard position={value} />
    </ul>
  );
}

describe("PortfolioPositionCard", () => {
  it("renders the position facts, progress and the funding status body", () => {
    renderCard(position());

    expect(screen.getByRole("heading", { level: 3, name: "Panadería Horizonte SRL" })).toBeInTheDocument();
    expect(screen.getByText("Alimentos · Córdoba")).toBeInTheDocument();
    expect(screen.getByText("SIMULADO")).toBeInTheDocument();
    expect(screen.getByText("Mi aporte")).toBeInTheDocument();
    expect(screen.getByText("250,0000000 XLM")).toBeInTheDocument();
    expect(screen.getByText("63 % de la meta")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progreso de Panadería Horizonte SRL" })).toBeInTheDocument();
    expect(screen.getByText("Fondeo abierto")).toBeInTheDocument();
    expect(screen.getByText("Podés retirar tu aporte hasta el cierre, el 30/11/2026.")).toBeInTheDocument();
  });

  it("links to the campaign with an accessible name", () => {
    renderCard(position());
    expect(screen.getByRole("link", { name: "Ver campaña Panadería Horizonte SRL" })).toHaveAttribute(
      "href",
      `/campaigns/${CAMPAIGN_ID}`
    );
  });

  it("renders the settled label with no body", () => {
    renderCard(position({ status: "settled" }));

    expect(screen.getByText("Meta alcanzada")).toBeInTheDocument();
    expect(screen.queryByText(/Podés retirar tu aporte/)).not.toBeInTheDocument();
  });

  it("renders the refunding label with no body", () => {
    renderCard(position({ status: "refunding" }));

    expect(screen.getByText("Reembolso disponible")).toBeInTheDocument();
    expect(screen.queryByText(/Podés retirar tu aporte/)).not.toBeInTheDocument();
  });

  it("renders the composed action slot when one is provided", () => {
    render(
      <ul>
        <PortfolioPositionCard
          position={position()}
          action={<button type="button">Retirar mi aporte</button>}
        />
      </ul>
    );

    expect(screen.getByRole("button", { name: "Retirar mi aporte" })).toBeInTheDocument();
  });

  it("shows the vault with its explorer link and each observed contribution with hash, amount and date (#438/WU5)", () => {
    renderCard(
      position({
        vaultExplorerUrl: `https://explorer.example/contract/${VAULT}`,
        transactions: [
          { transactionHash: HASH_A, amountXlm: "150.0000000", observedAt: "2026-10-01T23:30:00.000Z", explorerUrl: null },
          {
            transactionHash: HASH_B,
            amountXlm: "100.0000000",
            observedAt: "2026-10-08T10:05:00.000Z",
            explorerUrl: `https://explorer.example/tx/${HASH_B}`
          }
        ]
      })
    );

    const vaultLink = screen.getByRole("link", {
      name: `Ver en el explorador: bóveda de Panadería Horizonte SRL ${VAULT} (abre en una pestaña nueva)`
    });
    expect(vaultLink).toHaveAttribute("href", `https://explorer.example/contract/${VAULT}`);
    expect(vaultLink).toHaveAttribute("target", "_blank");
    expect(vaultLink).toHaveAttribute("rel", "noreferrer noopener");

    const list = screen.getByRole("list", { name: "Tus transacciones de aporte" });
    expect(list).toHaveTextContent("150,0000000 XLM");
    expect(list).toHaveTextContent("01/10/2026");
    expect(screen.getByTitle(HASH_A)).toBeInTheDocument();
    const txLink = screen.getByRole("link", {
      name: `Ver en el explorador: hash del aporte ${HASH_B} (abre en una pestaña nueva)`
    });
    expect(txLink).toHaveAttribute("href", `https://explorer.example/tx/${HASH_B}`);
    // The first transaction has no explorer URL: its hash renders without a link.
    expect(screen.queryByRole("link", { name: new RegExp(HASH_A) })).not.toBeInTheDocument();
  });

  it("shows «Sin dato» for the hash proof of a contribution made before hashes were persisted, never a zero", () => {
    renderCard(position());

    expect(screen.getByText("Hash del aporte")).toBeInTheDocument();
    expect(screen.getByText("Sin dato")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tus transacciones de aporte" })).not.toBeInTheDocument();
    // No explorer base: the vault renders without a link, too.
    expect(screen.queryByRole("link", { name: /bóveda/ })).not.toBeInTheDocument();
    expect(screen.getByTitle(VAULT)).toBeInTheDocument();
  });

  it("lists the hashed contributions and discloses the earlier part with no recorded hash", () => {
    renderCard(
      position({
        contributionXlm: "350.0000000",
        transactions: [
          { transactionHash: HASH_B, amountXlm: "100.0000000", observedAt: "2026-10-08T10:05:00.000Z", explorerUrl: null }
        ]
      })
    );

    expect(screen.getByRole("list", { name: "Tus transacciones de aporte" })).toHaveTextContent("100,0000000 XLM");
    expect(
      screen.getByText("Aportes anteriores sin hash registrado: 250,0000000 XLM · Sin dato")
    ).toBeInTheDocument();
  });

  it("shows no unhashed-contribution line when every contribution has a hash", () => {
    renderCard(
      position({
        transactions: [
          { transactionHash: HASH_B, amountXlm: "250.0000000", observedAt: "2026-10-08T10:05:00.000Z", explorerUrl: null }
        ]
      })
    );

    expect(screen.queryByText(/sin hash registrado/)).not.toBeInTheDocument();
  });

  it("renders no action slot by default", () => {
    renderCard(position());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
