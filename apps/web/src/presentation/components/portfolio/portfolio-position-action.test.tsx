import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import type { UseCampaignVaultOptions } from "@/state/use-campaign-vault";
import { FakeWallet, FakeWalletConnection } from "@/test/fake-wallet";
import type { CampaignSnapshot } from "@vaqcrow/contracts";
import {
  PortfolioPositionAction,
  positionActionDescriptionRows,
  positionActionStatusItems
} from "./portfolio-position-action";

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
    vaultAddress: VAULT,
    vaultExplorerUrl: null,
    transactions: [],
    ...overrides
  };
}

function snapshot(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  return {
    campaignId: CAMPAIGN_ID,
    applicationId: APPLICATION_ID,
    contractAddress: VAULT,
    network: "TESTNET",
    state: "funding",
    goalStroops: 50_000_000n,
    totalStroops: 15_000_000n,
    investorContributionStroops: 250_000_000n,
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
    getTransaction: vi.fn().mockResolvedValue({ transactionHash: HASH, status: "success", campaign: snapshot() }),
    ...overrides
  } as unknown as CampaignGateway;
}

interface RenderOptions {
  readonly position?: PortfolioPosition;
  readonly gateway?: CampaignGateway;
  readonly wallet?: WalletPort;
  readonly connection?: FakeWalletConnection;
  readonly onConnectWallet?: () => void;
  readonly onActionSubmitted?: () => void;
  /** Bounded-poll timing; lets a case drive the engine's poll to exhaustion fast. */
  readonly vaultOptions?: UseCampaignVaultOptions;
}

function renderAction(options: RenderOptions = {}) {
  return render(
    <PortfolioPositionAction
      position={options.position ?? position()}
      gateway={options.gateway ?? createGateway()}
      wallet={options.wallet ?? new FakeWallet({ publicKey: INVESTOR })}
      connection={options.connection ?? new FakeWalletConnection({ publicKey: INVESTOR, frozen: false })}
      {...(options.onConnectWallet ? { onConnectWallet: options.onConnectWallet } : {})}
      {...(options.onActionSubmitted ? { onActionSubmitted: options.onActionSubmitted } : {})}
      {...(options.vaultOptions ? { vaultOptions: options.vaultOptions } : {})}
    />
  );
}

async function enabledButton(name: string): Promise<HTMLElement> {
  const button = await screen.findByRole("button", { name });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe("PortfolioPositionAction: the status-driven choice", () => {
  it("shows the withdraw action for a funding position", async () => {
    renderAction();
    expect(await screen.findByRole("button", { name: "Retirar mi aporte" })).toBeInTheDocument();
  });

  it("shows the refund action for a refunding position", async () => {
    renderAction({ position: position({ status: "refunding" }) });
    expect(await screen.findByRole("button", { name: "Reembolsar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirar mi aporte" })).not.toBeInTheDocument();
  });

  it("shows no action for a settled position", async () => {
    renderAction({ position: position({ status: "settled" }) });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("button", { name: /Retirar|Reembolsar/ })).not.toBeInTheDocument();
  });

  it("reads the campaign with the persisted connection's public key", async () => {
    const gateway = createGateway();
    renderAction({ gateway });

    await screen.findByRole("button", { name: "Retirar mi aporte" });
    await waitFor(() => expect(gateway.getCampaign).toHaveBeenCalledWith(CAMPAIGN_ID, INVESTOR));
  });
});

describe("PortfolioPositionAction: the review modal", () => {
  it("opens the shared review with the withdraw function, the contract and the custody", async () => {
    renderAction();
    fireEvent.click(await enabledButton("Retirar mi aporte"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Retirar tu aporte de Panadería Horizonte SRL")).toBeInTheDocument();
    expect(within(dialog).getByText("withdraw")).toBeInTheDocument();
    expect(within(dialog).getByText("El contrato de la bóveda, no una persona")).toBeInTheDocument();
    expect(within(dialog).getByText("Stellar Testnet")).toBeInTheDocument();
    expect(within(dialog).getByText("250.0000000")).toBeInTheDocument();
    expect(within(dialog).getByText(TRUNCATED_VAULT)).toBeInTheDocument();
    expect(within(dialog).getByText(VAULT)).toHaveClass("sr-only");
  });

  it("opens the refund review with the refund function", async () => {
    renderAction({ position: position({ status: "refunding" }) });
    fireEvent.click(await enabledButton("Reembolsar"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Reembolsar tu aporte de Panadería Horizonte SRL")).toBeInTheDocument();
    expect(within(dialog).getByText("refund")).toBeInTheDocument();
  });
});

describe("PortfolioPositionAction: after signing", () => {
  it("shows the sent state while the submission is in flight and never claims confirmation", async () => {
    // The submission never resolves: the card must show "Enviada · pendiente de
    // confirmación" and never a locally-claimed confirmation.
    const gateway = createGateway({ submitInvocation: vi.fn().mockReturnValue(new Promise(() => {})) });
    renderAction({ gateway });
    fireEvent.click(await enabledButton("Retirar mi aporte"));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Firmar en Freighter" }));

    expect(await screen.findByText("Enviada · pendiente de confirmación")).toBeInTheDocument();
    expect(screen.queryByText("Confirmada en el ledger")).not.toBeInTheDocument();
    expect(screen.queryByText(/está confirmada\./i)).not.toBeInTheDocument();
  });

  it("shows a bounded poll timeout as pending, never failed nor confirmed", async () => {
    // Every poll answer is "pending", so the engine's bounded poll exhausts and
    // reports `unavailable`. A timeout is NOT a failure: the card must stay on
    // "Enviada · pendiente de confirmación" and claim neither failure nor
    // ledger confirmation.
    const getTransaction = vi.fn().mockResolvedValue({ transactionHash: HASH, status: "pending" });
    renderAction({ gateway: createGateway({ getTransaction }), vaultOptions: { pollIntervalMs: 0, maxPollAttempts: 3 } });
    fireEvent.click(await enabledButton("Retirar mi aporte"));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Firmar en Freighter" }));

    await waitFor(() => expect(getTransaction).toHaveBeenCalledTimes(3));
    expect(screen.getByText("Enviada · pendiente de confirmación")).toBeInTheDocument();
    expect(screen.queryByText("Fallida")).not.toBeInTheDocument();
    expect(screen.queryByText("Confirmada en el ledger")).not.toBeInTheDocument();
  });

  it("shows the ledger confirmation only once the engine's poll observed it", async () => {
    renderAction();
    fireEvent.click(await enabledButton("Retirar mi aporte"));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Firmar en Freighter" }));

    expect(await screen.findByText("Confirmada en el ledger")).toBeInTheDocument();
  });

  it("shows a failed transaction as failed", async () => {
    const gateway = createGateway({
      getTransaction: vi.fn().mockResolvedValue({ transactionHash: HASH, status: "failed" })
    });
    renderAction({ gateway });
    fireEvent.click(await enabledButton("Retirar mi aporte"));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Firmar en Freighter" }));

    expect(await screen.findByText("Fallida")).toBeInTheDocument();
  });

  it("notifies the owner after the attempt settles", async () => {
    const onActionSubmitted = vi.fn();
    renderAction({ onActionSubmitted });
    fireEvent.click(await enabledButton("Retirar mi aporte"));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Firmar en Freighter" }));

    await waitFor(() => expect(onActionSubmitted).toHaveBeenCalledTimes(1));
  });
});

describe("PortfolioPositionAction: without a connected wallet", () => {
  it("calls the injected connect handler and never opens the review", async () => {
    const onConnectWallet = vi.fn();
    renderAction({
      connection: new FakeWalletConnection({ publicKey: null, frozen: false }),
      onConnectWallet
    });

    fireEvent.click(await enabledButton("Retirar mi aporte"));

    expect(onConnectWallet).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates to /portfolio by default", async () => {
    renderAction({ connection: new FakeWalletConnection({ publicKey: null, frozen: false }) });

    fireEvent.click(await enabledButton("Retirar mi aporte"));

    expect(push).toHaveBeenCalledWith("/portfolio");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// Moved out of `application/portfolio/actions.test.ts`: these two helpers live
// in the presentation layer now that they name the shared components' types.
describe("positionActionStatusItems", () => {
  it("walks signed, then sent pending of confirmation", () => {
    expect(positionActionStatusItems("signed")).toEqual([{ state: "signed" }]);
    expect(positionActionStatusItems("sent")).toEqual([{ state: "signed" }, { state: "sent" }]);
  });

  it("appends the confirmed terminal state after sent", () => {
    expect(positionActionStatusItems("confirmed")).toEqual([
      { state: "signed" },
      { state: "sent" },
      { state: "confirmed" }
    ]);
  });

  it("appends the failed terminal state after sent", () => {
    expect(positionActionStatusItems("failed")).toEqual([
      { state: "signed" },
      { state: "sent" },
      { state: "failed" }
    ]);
  });
});

describe("positionActionDescriptionRows", () => {
  it("names the contract, the invoked function and the custody", () => {
    expect(positionActionDescriptionRows("withdraw", "VAULT-ADDRESS")).toEqual([
      { label: "Contrato", value: "VAULT-ADDRESS", mono: true },
      { label: "Función", value: "withdraw" },
      { label: "Custodia", value: "El contrato de la bóveda, no una persona" }
    ]);
  });

  it("declares the refund function for a refund", () => {
    expect(positionActionDescriptionRows("refund", "VAULT-ADDRESS")[1]).toEqual({
      label: "Función",
      value: "refund"
    });
  });
});
