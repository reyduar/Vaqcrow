import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { FakeWallet, FakeWalletConnection } from "@/test/fake-wallet";
import type { CampaignSnapshot } from "@vaqcrow/contracts";
import { CampaignWithdraw } from "./campaign-withdraw";

// The component reads `useRouter` for its production default navigation; tests
// inject `onConnectWallet`, and one case asserts the default is `/portfolio`.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
});

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const APPLICATION_ID = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const VAULT = "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const SME = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const INVESTOR = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const HASH = "TRANSACTION-HASH";
const TRUNCATED_VAULT = `${VAULT.slice(0, 10)}…${VAULT.slice(-8)}`;
const CONTRIBUTION = 25_000_000n; // 2.5 XLM

function snapshot(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  return {
    campaignId: CAMPAIGN_ID,
    applicationId: APPLICATION_ID,
    contractAddress: VAULT,
    network: "TESTNET",
    state: "funding",
    goalStroops: 50000000n,
    totalStroops: 15000000n,
    investorContributionStroops: CONTRIBUTION,
    deadline: "2026-12-01T00:00:00.000Z",
    smeAccountId: SME,
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
      operation: "withdraw",
      xdr: "UNSIGNED-XDR",
      networkPassphrase: "passphrase",
      expiresAt: "2026-09-21T12:15:00.000Z"
    }),
    submitInvocation: vi.fn().mockResolvedValue({ transactionHash: HASH, status: "accepted" }),
    getTransaction: vi
      .fn()
      .mockResolvedValue({ transactionHash: HASH, status: "success", campaign: snapshot() }),
    ...overrides
  } as unknown as CampaignGateway;
}

interface RenderOptions {
  readonly status?: "funding" | "settled" | "refunding";
  readonly viewerRole?: PrincipalRole | null;
  readonly gateway?: CampaignGateway;
  readonly wallet?: WalletPort;
  readonly connection?: FakeWalletConnection;
  readonly onConnectWallet?: () => void;
}

function renderWithdraw(options: RenderOptions = {}) {
  return render(
    <CampaignWithdraw
      campaignId={CAMPAIGN_ID}
      campaignName="Panadería Horizonte SRL"
      vaultAddress={VAULT}
      status={options.status ?? "funding"}
      viewerRole={options.viewerRole === undefined ? "INVERSOR" : options.viewerRole}
      gateway={options.gateway ?? createGateway()}
      wallet={options.wallet ?? new FakeWallet({ publicKey: INVESTOR })}
      connection={options.connection ?? new FakeWalletConnection({ publicKey: INVESTOR, frozen: false })}
      {...(options.onConnectWallet ? { onConnectWallet: options.onConnectWallet } : {})}
    />
  );
}

async function enabledWithdraw() {
  const button = await screen.findByRole("button", { name: "Retirar mi aporte" });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe("CampaignWithdraw: the gate", () => {
  it("shows the control for a funding campaign where the investor has a positive contribution", async () => {
    renderWithdraw();
    expect(await screen.findByRole("button", { name: "Retirar mi aporte" })).toBeInTheDocument();
  });

  it.each(["settled", "refunding"] as const)("hides the control on a %s campaign", async (status) => {
    renderWithdraw({ status });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("button", { name: /Retirar/ })).not.toBeInTheDocument();
  });

  it.each(["PYME", "ADMIN", null] as const)("hides the control for a %s viewer", async (viewerRole) => {
    renderWithdraw({ viewerRole });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("button", { name: /Retirar/ })).not.toBeInTheDocument();
  });

  it("hides the control when the investor's contribution is zero", async () => {
    renderWithdraw({ gateway: createGateway({ getCampaign: vi.fn().mockResolvedValue(snapshot({ investorContributionStroops: 0n })) }) });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("button", { name: /Retirar/ })).not.toBeInTheDocument();
  });

  it("reads the investor's own contribution with the persisted connection's public key", async () => {
    const gateway = createGateway();
    renderWithdraw({ gateway });

    await screen.findByRole("button", { name: "Retirar mi aporte" });
    await waitFor(() => expect(gateway.getCampaign).toHaveBeenCalledWith(CAMPAIGN_ID, INVESTOR));
  });
});

describe("CampaignWithdraw: the review modal", () => {
  it("opens the shared review with the withdraw function, the contract and the custody", async () => {
    renderWithdraw();
    fireEvent.click(await enabledWithdraw());

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Retirar tu aporte de Panadería Horizonte SRL")).toBeInTheDocument();
    expect(within(dialog).getByText("withdraw")).toBeInTheDocument();
    expect(within(dialog).getByText("El contrato de la bóveda, no una persona")).toBeInTheDocument();
    expect(within(dialog).getByText("Stellar Testnet")).toBeInTheDocument();
    // The amount to withdraw, then the vault id middle-truncated (full value only for AT).
    expect(within(dialog).getByText("2.5")).toBeInTheDocument();
    expect(within(dialog).getByText(TRUNCATED_VAULT)).toBeInTheDocument();
    expect(within(dialog).getByText(VAULT)).toHaveClass("sr-only");
  });
});

describe("CampaignWithdraw: after signing", () => {
  it("shows the sent notice and never claims confirmation", async () => {
    renderWithdraw();
    fireEvent.click(await enabledWithdraw());

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Firmar en Freighter" }));

    expect(await screen.findByText("Enviada · pendiente de confirmación.")).toBeInTheDocument();
    expect(screen.getByText("La transacción fue enviada, pero todavía no está confirmada")).toBeInTheDocument();
    expect(screen.queryByText(/confirmada por la red|está confirmada\./i)).not.toBeInTheDocument();
  });

  it("reports a sanitized failure inside the review, never the provider's message", async () => {
    const prepareInvocation = vi.fn().mockRejectedValue(new HttpClientError("http", 503, undefined, undefined));
    renderWithdraw({ gateway: createGateway({ prepareInvocation }) });
    fireEvent.click(await enabledWithdraw());

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Firmar en Freighter" }));

    const alert = await within(screen.getByRole("dialog")).findByRole("alert");
    expect(alert).toHaveTextContent("El servicio no está disponible en este momento. No se registró nada; podés reintentar.");
    expect(screen.queryByText(/HTTP request failed/i)).not.toBeInTheDocument();
  });
});

describe("CampaignWithdraw: without a connected wallet", () => {
  it("redirects to the portfolio and never opens the review", async () => {
    const onConnectWallet = vi.fn();
    renderWithdraw({
      connection: new FakeWalletConnection({ publicKey: null, frozen: false }),
      onConnectWallet
    });

    fireEvent.click(await enabledWithdraw());

    expect(onConnectWallet).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates to /portfolio by default", async () => {
    renderWithdraw({ connection: new FakeWalletConnection({ publicKey: null, frozen: false }) });

    fireEvent.click(await enabledWithdraw());

    expect(push).toHaveBeenCalledWith("/portfolio");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
