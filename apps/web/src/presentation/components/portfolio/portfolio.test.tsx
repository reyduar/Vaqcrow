import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { PortfolioPort, PortfolioSummary } from "@/application/ports/portfolio-port";
import type { WalletBalancePort } from "@/application/ports/wallet-balance-port";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import { Portfolio } from "./portfolio";

// The container composes `PortfolioPositionAction`, which reads `useRouter` for
// its production default navigation; stub it so no app router is required.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const SWR_ISOLATED = { provider: () => new Map(), dedupingInterval: 0 } as const;

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

function position(overrides: Partial<PortfolioSummary["contributions"][number]> = {}) {
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
    status: "funding" as const,
    closeDate: "2026-11-30T12:00:00.000Z",
    vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
    ...overrides
  };
}

function summary(overrides: Partial<PortfolioSummary> = {}): PortfolioSummary {
  return {
    contributions: [position()],
    distributions: [],
    totals: { totalContributedXlm: "250.0000000", totalDistributionsXlm: null, campaignCount: 1 },
    ...overrides
  };
}

function okPort(value: PortfolioSummary = summary()): PortfolioPort {
  return { get: vi.fn().mockResolvedValue({ ok: true, summary: value }) };
}

function connection(publicKey: string | null): WalletConnectionPort {
  return {
    requestChallenge: vi.fn(),
    submitConnection: vi.fn(),
    getConnection: vi.fn().mockResolvedValue({ ok: true, publicKey, frozen: false })
  };
}

const BALANCE: WalletBalancePort = { getBalance: vi.fn().mockResolvedValue({ ok: true, balanceXlm: "1250.0000000" }) };

function renderPortfolio(props: Parameters<typeof Portfolio>[0]) {
  const ui: ReactNode = <Portfolio {...props} />;
  return render(<SWRConfig value={SWR_ISOLATED}>{ui}</SWRConfig>);
}

function positionHeadings(): (string | null)[] {
  return screen.queryAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
}

describe("Portfolio container", () => {
  it("shows the title, the stat cards and the sections when the read succeeds", async () => {
    renderPortfolio({ port: okPort(), connection: connection(null), balance: BALANCE });

    expect(await screen.findByText("Total aportado")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Mi portafolio" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mis aportes en PyMEs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aportes por sector" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Distribuciones" })).toBeInTheDocument();
  });

  it("renders no wallet card when there is no connected key", async () => {
    renderPortfolio({ port: okPort(), connection: connection(null), balance: BALANCE });

    await screen.findByText("Total aportado");
    expect(screen.queryByText("Freighter conectada de forma no custodial")).not.toBeInTheDocument();
  });

  it("renders the wallet card when a public key exists", async () => {
    renderPortfolio({
      port: okPort(),
      connection: connection("GBX4RK7PQ2M6VZ5HJTN3WLCE8YDA9SFU4GQOB2XK7IRMNHT6PLQ7LM"),
      balance: BALANCE
    });

    expect(await screen.findByText("Freighter conectada de forma no custodial")).toBeInTheDocument();
  });

  it("shows the error state with retry, and retrying re-reads", async () => {
    const get = vi.fn().mockResolvedValue({ ok: false, code: "network" });
    renderPortfolio({ port: { get }, connection: connection(null), balance: BALANCE });

    expect(await screen.findByText("No pudimos cargar tu portafolio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("reorders positions when switching to Por estado", async () => {
    const settled = position({ campaignId: "b", name: "Meta", status: "settled" });
    const funding = position({ campaignId: "a", name: "Fondeo", status: "funding" });
    renderPortfolio({
      port: okPort(summary({ contributions: [settled, funding] })),
      connection: connection(null),
      balance: BALANCE
    });

    await screen.findByText("Meta");
    expect(positionHeadings()).toEqual(["Meta", "Fondeo"]);

    fireEvent.click(screen.getByRole("button", { name: "Por estado" }));
    expect(positionHeadings()).toEqual(["Fondeo", "Meta"]);
  });

  it("shows a loading status while the read is in flight", async () => {
    const get = vi.fn().mockReturnValue(new Promise(() => {}));
    renderPortfolio({ port: { get }, connection: connection(null), balance: BALANCE });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("composes the withdraw action into a funding position", async () => {
    renderPortfolio({ port: okPort(), connection: connection(null), balance: BALANCE });

    expect(await screen.findByRole("button", { name: "Retirar mi aporte" })).toBeInTheDocument();
  });
});
