import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import { CompanyVaultList } from "./company-vault-list";

const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";

function campaign(overrides: Partial<MyCampaign> = {}): MyCampaign {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Campaña 2026 · Panadería Horizonte",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    vaultAddress: VAULT,
    vaultExplorerUrl: null,
    state: "funding",
    goalArs: 15_000_000,
    raisedArs: 9_450_000,
    fundedPercentBps: 6_300,
    deadline: "2026-11-30T12:00:00.000Z",
    contributorsCount: 38,
    distributions: [],
    sales: [],
    ...overrides
  };
}

function renderList(campaigns: readonly MyCampaign[]) {
  return render(<CompanyVaultList campaigns={campaigns} sort="recent" onSortChange={() => undefined} />);
}

describe("CompanyVaultList vault proof (#438/WU5)", () => {
  it("links each vault to the explorer with a name that says which campaign's vault it is", () => {
    const url = `https://explorer.example/contract/${VAULT}`;
    renderList([campaign({ vaultExplorerUrl: url })]);

    const link = screen.getByRole("link", {
      name: `Ver bóveda en el explorador: bóveda de Campaña 2026 · Panadería Horizonte ${VAULT} (abre en una pestaña nueva)`
    });
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveTextContent("Ver bóveda en el explorador");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("keeps the vault address without a link when the explorer URL is null", () => {
    renderList([campaign()]);

    expect(screen.getByTitle(VAULT)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
