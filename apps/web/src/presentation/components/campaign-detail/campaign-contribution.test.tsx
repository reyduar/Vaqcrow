import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import type { CampaignDetail, CampaignDetailPort } from "@/application/ports/campaign-detail-port";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { FakeWallet, FakeWalletConnection } from "@/test/fake-wallet";
import type { CampaignSnapshot } from "@vaqcrow/contracts";
import { CampaignDetail as CampaignDetailController } from "./campaign-detail";

// The contribution component reads `useRouter` for its production default
// navigation; tests inject `onConnectWallet`, and one case asserts the
// component's own default is `/portfolio`.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
});

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const VAULT = "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const INVESTOR = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const HASH = "TRANSACTION-HASH";
const TRUNCATED_VAULT = `${VAULT.slice(0, 10)}…${VAULT.slice(-8)}`;

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

function detail(overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    campaignId: CAMPAIGN_ID,
    name: "Panadería Horizonte SRL",
    sector: "Alimentos",
    city: "Rosario",
    description: "Panificados artesanales para comercios de cercanía.",
    foundedAt: "2021-05-01T12:00:00.000Z",
    goalArs: 9_450_000,
    raisedArs: 5_954_000,
    fundedPercentBps: 6_300,
    revenueShare: 4.5,
    riskBand: "medium",
    riskConfidence: 0.8,
    closeDate: "2026-11-30T12:00:00.000Z",
    imageSrc: null,
    status: "funding",
    backers: 12,
    vaultAddress: VAULT,
    assessment: null,
    decision: null,
    ...overrides
  };
}

function snapshot(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  return {
    campaignId: CAMPAIGN_ID,
    applicationId: "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f",
    contractAddress: VAULT,
    network: "TESTNET",
    state: "funding",
    goalStroops: 50000000n,
    totalStroops: 15000000n,
    deadline: "2026-12-01T00:00:00.000Z",
    smeAccountId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    reconciliationStatus: "in_sync",
    ...overrides
  } as unknown as CampaignSnapshot;
}

function createGateway(overrides: Partial<CampaignGateway> = {}): CampaignGateway {
  return {
    openCampaign: vi.fn(),
    getCampaign: vi.fn().mockResolvedValue(snapshot()),
    prepareInvocation: vi.fn().mockResolvedValue({
      invocationId: "22222222-2222-4222-8222-222222222222",
      operation: "contribute",
      xdr: "UNSIGNED-XDR",
      networkPassphrase: "passphrase",
      expiresAt: "2026-09-21T12:15:00.000Z"
    }),
    submitInvocation: vi.fn().mockResolvedValue({ transactionHash: HASH, status: "accepted" }),
    getTransaction: vi
      .fn()
      .mockResolvedValue({ transactionHash: HASH, status: "success", campaign: snapshot({ totalStroops: 30000000n }) }),
    ...overrides
  } as unknown as CampaignGateway;
}

interface RenderOptions {
  readonly detailOverrides?: Partial<CampaignDetail>;
  readonly role?: PrincipalRole | null;
  readonly connection?: FakeWalletConnection;
  readonly wallet?: WalletPort;
  readonly gateway?: CampaignGateway;
  readonly onConnectWallet?: () => void;
}

function renderFlow(options: RenderOptions = {}) {
  const port: CampaignDetailPort = {
    get: vi.fn().mockResolvedValue({ ok: true, detail: detail(options.detailOverrides) })
  };
  return render(
    <CampaignDetailController
      campaignId={CAMPAIGN_ID}
      signedIn
      role={options.role ?? "INVERSOR"}
      port={port}
      contribution={{
        gateway: options.gateway ?? createGateway(),
        wallet: options.wallet ?? new FakeWallet({ publicKey: INVESTOR }),
        connection: options.connection ?? new FakeWalletConnection({ publicKey: INVESTOR, frozen: false }),
        ...(options.onConnectWallet ? { onConnectWallet: options.onConnectWallet } : {})
      }}
    />,
    { wrapper }
  );
}

async function loadedHeading() {
  return screen.findByRole("heading", { level: 1, name: "Panadería Horizonte SRL" });
}

async function enabledCta() {
  const cta = screen.getByRole("button", { name: "Aportar a la campaña" });
  await waitFor(() => expect(cta).toBeEnabled());
  return cta;
}

describe("CampaignContribution: the gate", () => {
  it("shows the CTA only for a funding campaign", async () => {
    const funding = renderFlow();
    await loadedHeading();
    expect(screen.getByRole("button", { name: "Aportar a la campaña" })).toBeInTheDocument();
    funding.unmount();

    for (const status of ["settled", "refunding"] as const) {
      const view = renderFlow({ detailOverrides: { status } });
      await loadedHeading();
      expect(screen.queryByRole("button", { name: /Aportar/ })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("never shows the CTA to a PYME (it must not contribute to its own campaign)", async () => {
    renderFlow({ role: "PYME" });
    await loadedHeading();
    expect(screen.queryByRole("button", { name: /Aportar/ })).not.toBeInTheDocument();
  });

  it("shows no CTA when the campaign has no vault id", async () => {
    renderFlow({ detailOverrides: { vaultAddress: null } });
    await loadedHeading();
    expect(screen.queryByRole("button", { name: /Aportar/ })).not.toBeInTheDocument();
  });
});

describe("CampaignContribution: without a connected wallet", () => {
  it("redirects to the portfolio and never opens the review", async () => {
    const onConnectWallet = vi.fn();
    renderFlow({
      connection: new FakeWalletConnection({ publicKey: null, frozen: false }),
      onConnectWallet
    });
    await loadedHeading();
    const cta = await enabledCta();

    fireEvent.change(screen.getByLabelText(/Monto del aporte/), { target: { value: "15" } });
    fireEvent.click(cta);

    expect(onConnectWallet).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates to /portfolio by default", async () => {
    renderFlow({ connection: new FakeWalletConnection({ publicKey: null, frozen: false }) });
    await loadedHeading();
    const cta = await enabledCta();

    fireEvent.change(screen.getByLabelText(/Monto del aporte/), { target: { value: "15" } });
    fireEvent.click(cta);

    expect(push).toHaveBeenCalledWith("/portfolio");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("CampaignContribution: the review modal", () => {
  it("opens with the shortened vault id, the minimum and the contribute function", async () => {
    renderFlow();
    await loadedHeading();
    const cta = await enabledCta();

    fireEvent.change(screen.getByLabelText(/Monto del aporte/), { target: { value: "15" } });
    fireEvent.click(cta);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Aportar a Panadería Horizonte SRL")).toBeInTheDocument();
    expect(within(dialog).getByText("contribute")).toBeInTheDocument();
    expect(within(dialog).getByText("10 XLM de prueba")).toBeInTheDocument();
    expect(within(dialog).getByText("El contrato de la bóveda, no una persona")).toBeInTheDocument();
    expect(within(dialog).getByText("Stellar Testnet")).toBeInTheDocument();
    // The vault id is middle-truncated; the full value stays only for assistive tech.
    expect(within(dialog).getByText(TRUNCATED_VAULT)).toBeInTheDocument();
    expect(within(dialog).getByText(VAULT)).toHaveClass("sr-only");
  });

  it("blocks review with a visible reason when the amount is below the minimum", async () => {
    renderFlow();
    await loadedHeading();
    const cta = await enabledCta();

    fireEvent.change(screen.getByLabelText(/Monto del aporte/), { target: { value: "5" } });
    fireEvent.click(cta);

    expect(await screen.findByRole("alert")).toHaveTextContent("El aporte mínimo es 10 XLM.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("CampaignContribution: after signing", () => {
  it("shows the sent notice and turns the CTA into Aportar de nuevo", async () => {
    renderFlow();
    await loadedHeading();
    const cta = await enabledCta();

    fireEvent.change(screen.getByLabelText(/Monto del aporte/), { target: { value: "15" } });
    fireEvent.click(cta);

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Firmar en Freighter" }));

    expect(await screen.findByText("Enviada · pendiente de confirmación.")).toBeInTheDocument();
    expect(
      screen.getByText("La transacción fue enviada, pero todavía no está confirmada")
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Aportar de nuevo" })).toBeInTheDocument();
    // Signing is never reported as confirmed by the UI.
    expect(screen.queryByText(/confirmada por la red|está confirmada\./i)).not.toBeInTheDocument();
  });
});
