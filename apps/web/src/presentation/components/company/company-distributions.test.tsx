import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MyCampaign, MyCampaignDistribution } from "@/application/ports/my-campaigns-port";
import { microcopy } from "@/application/trust/disclosures";
import { CompanyDistributions } from "./company-distributions";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function distribution(overrides: Partial<MyCampaignDistribution> = {}): MyCampaignDistribution {
  return {
    distributionId: "11111111-1111-4111-8111-111111111111",
    period: "2026-08",
    amountArs: 168_561,
    amountXlm: "1.2500000",
    state: "confirmed",
    transactionHash: HASH_A,
    explorerUrl: null,
    ...overrides
  };
}

function campaign(distributions: readonly MyCampaignDistribution[]): MyCampaign {
  return {
    campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
    name: "Campaña 2026 · Panadería Horizonte",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
    vaultExplorerUrl: null,
    state: "settled",
    goalArs: 15_000_000,
    raisedArs: 15_000_000,
    fundedPercentBps: 10_000,
    deadline: "2026-11-30T12:00:00.000Z",
    contributorsCount: 38,
    distributions,
    sales: []
  };
}

describe("CompanyDistributions proof (#438/WU5)", () => {
  it("shows each distribution's hash, links it only when the API sends a URL, and states the hash note once", () => {
    render(
      <CompanyDistributions
        campaigns={[
          campaign([
            distribution(),
            distribution({
              distributionId: "22222222-2222-4222-8222-222222222222",
              transactionHash: HASH_B,
              explorerUrl: `https://explorer.example/tx/${HASH_B}`
            })
          ])
        ]}
      />
    );

    expect(screen.getByTitle(HASH_A)).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(`Ver en el explorador: hash ${HASH_B} (abre en una pestaña nueva)`);
    expect(links[0]).toHaveAttribute("href", `https://explorer.example/tx/${HASH_B}`);
    expect(screen.getAllByText(microcopy.hashTechnicalOnly)).toHaveLength(1);
  });

  it("shows no hash note when there are no distributions", () => {
    render(<CompanyDistributions campaigns={[campaign([])]} />);

    expect(screen.queryByText(microcopy.hashTechnicalOnly)).not.toBeInTheDocument();
  });
});
