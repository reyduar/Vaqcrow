import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { WalletError } from "@/application/ports/wallet-port";
import type { CampaignSnapshot } from "@vaqcrow/contracts";
import { CampaignWorkspace } from "./campaign-workspace";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const APPLICATION_ID = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const SME = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const INVESTOR = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const OTHER_INVESTOR = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const CONTRACT = "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const HASH = "TRANSACTION-HASH";

function snapshot(overrides: Partial<CampaignSnapshot> = {}): CampaignSnapshot {
  return {
    campaignId: CAMPAIGN_ID,
    applicationId: APPLICATION_ID,
    contractAddress: CONTRACT,
    network: "TESTNET",
    state: "funding",
    goalStroops: 50000000n,
    totalStroops: 15000000n,
    deadline: "2026-12-01T00:00:00.000Z",
    smeAccountId: SME,
    reconciliationStatus: "in_sync",
    ...overrides
  } as unknown as CampaignSnapshot;
}

function createGateway(overrides: Partial<CampaignGateway> = {}): CampaignGateway {
  return {
    openCampaign: vi.fn().mockResolvedValue({ applied: true, campaign: snapshot() }),
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

function createWallet(overrides: Partial<WalletPort> = {}): WalletPort {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    connect: vi.fn().mockResolvedValue({ publicKey: INVESTOR }),
    signTransaction: vi.fn().mockResolvedValue("SIGNED-XDR"),
    ...overrides
  } as unknown as WalletPort;
}

async function connect() {
  fireEvent.click(screen.getByRole("button", { name: /Conectar wallet/i }));
  await screen.findByText(/Wallet conectada/i);
}

describe("CampaignWorkspace: opening the vault", () => {
  it("renders the open panel with no campaign id and opens on submit", async () => {
    const gateway = createGateway();
    const onCampaignOpened = vi.fn();
    render(
      <CampaignWorkspace gateway={gateway} wallet={createWallet()} campaignId={null} onCampaignOpened={onCampaignOpened} />
    );
    await connect();

    fireEvent.change(screen.getByLabelText(/Meta/), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/Fecha límite/), { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByRole("button", { name: /Abrir bóveda/i }));

    await waitFor(() => expect(gateway.openCampaign).toHaveBeenCalled());
    expect(gateway.openCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ smeAccountId: INVESTOR, goalStroops: 50000000n })
    );
    await waitFor(() => expect(onCampaignOpened).toHaveBeenCalledWith(CAMPAIGN_ID));
  });
});

describe("CampaignWorkspace: the three chain states", () => {
  it("renders the funding state and offers contribute and withdraw", async () => {
    const gateway = createGateway({ getCampaign: vi.fn().mockResolvedValue(snapshot({ state: "funding" })) });
    render(<CampaignWorkspace gateway={gateway} wallet={createWallet()} campaignId={CAMPAIGN_ID} />);

    expect(await screen.findByText("Fondeo abierto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Aportar$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retirar mi aporte/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reembolsar/ })).not.toBeInTheDocument();
  });

  it("renders the settled state and hides contribute", async () => {
    const gateway = createGateway({ getCampaign: vi.fn().mockResolvedValue(snapshot({ state: "settled" })) });
    render(<CampaignWorkspace gateway={gateway} wallet={createWallet()} campaignId={CAMPAIGN_ID} />);

    expect(await screen.findByText("Meta alcanzada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Aportar$/ })).not.toBeInTheDocument();
    expect(screen.getByText(/ya no acepta aportes/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retirar mi aporte/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reembolsar/ })).not.toBeInTheDocument();
  });

  it("renders the refunding state, hides contribute, and offers refund", async () => {
    const gateway = createGateway({ getCampaign: vi.fn().mockResolvedValue(snapshot({ state: "refunding" })) });
    render(<CampaignWorkspace gateway={gateway} wallet={createWallet()} campaignId={CAMPAIGN_ID} />);

    expect(await screen.findByText("Reembolso disponible")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Aportar$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reembolsar/ })).toBeInTheDocument();
  });
});

describe("CampaignWorkspace: contributing", () => {
  it("prevents a double submit: two rapid clicks call prepareInvocation once", async () => {
    let resolvePrepare!: (value: unknown) => void;
    const prepareInvocation = vi.fn().mockReturnValue(new Promise((resolve) => (resolvePrepare = resolve)));
    const gateway = createGateway({ prepareInvocation });
    render(<CampaignWorkspace gateway={gateway} wallet={createWallet()} campaignId={CAMPAIGN_ID} />);
    await connect();
    await screen.findByText("Fondeo abierto");

    fireEvent.change(screen.getByLabelText(/Monto a aportar/), { target: { value: "1.5" } });
    const button = screen.getByRole("button", { name: /^Aportar$/ });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(prepareInvocation).toHaveBeenCalledTimes(1);

    resolvePrepare({
      invocationId: "22222222-2222-4222-8222-222222222222",
      operation: "contribute",
      xdr: "UNSIGNED-XDR",
      networkPassphrase: "passphrase",
      expiresAt: "2026-09-21T12:15:00.000Z"
    });
    await waitFor(() => expect(gateway.submitInvocation).toHaveBeenCalledTimes(1));
  });

  it("shows a wallet network mismatch message", async () => {
    const signTransaction = vi.fn().mockRejectedValue(new WalletError("network_mismatch", "another network"));
    const gateway = createGateway();
    render(<CampaignWorkspace gateway={gateway} wallet={createWallet({ signTransaction })} campaignId={CAMPAIGN_ID} />);
    await connect();
    await screen.findByText("Fondeo abierto");

    fireEvent.change(screen.getByLabelText(/Monto a aportar/), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Aportar$/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/otra red/i);
  });

  it("shows a gateway error message when the backend refuses", async () => {
    const prepareInvocation = vi.fn().mockRejectedValue(new HttpClientError("http", 503));
    const gateway = createGateway({ prepareInvocation });
    render(<CampaignWorkspace gateway={gateway} wallet={createWallet()} campaignId={CAMPAIGN_ID} />);
    await connect();
    await screen.findByText("Fondeo abierto");

    fireEvent.change(screen.getByLabelText(/Monto a aportar/), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Aportar$/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no está disponible/i);
  });
});

describe("CampaignWorkspace: refunding", () => {
  it("sends the declared target address when refunding on behalf of another investor", async () => {
    const gateway = createGateway({ getCampaign: vi.fn().mockResolvedValue(snapshot({ state: "refunding" })) });
    render(<CampaignWorkspace gateway={gateway} wallet={createWallet()} campaignId={CAMPAIGN_ID} />);
    await connect();
    await screen.findByText("Reembolso disponible");

    fireEvent.change(screen.getByLabelText(/Cuenta a reembolsar/), { target: { value: OTHER_INVESTOR } });
    fireEvent.click(screen.getByRole("button", { name: /Reembolsar/ }));

    await waitFor(() =>
      expect(gateway.prepareInvocation).toHaveBeenCalledWith(
        CAMPAIGN_ID,
        expect.objectContaining({ operation: "refund", investorAccountId: OTHER_INVESTOR, sourceAccountId: INVESTOR })
      )
    );
  });
});
