import { fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { WalletError } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import type { CampaignSnapshot } from "@vaqcrow/contracts";
import { JourneyStoreProvider, useJourneyStore } from "@/state/journey-store-provider";
import { CampaignWorkspace } from "./campaign-workspace";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const APPLICATION_ID = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const SME = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const INVESTOR = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const OTHER_INVESTOR = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const CONTRACT = "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";
const HASH = "TRANSACTION-HASH";

/** The journey as the approval step leaves it: an application, no campaign yet. */
const render = (ui: ReactElement) =>
  rtlRender(<JourneyStoreProvider initial={{ applicationId: APPLICATION_ID }}>{ui}</JourneyStoreProvider>);

/** The journey once a campaign is known: what a reload of `/funding?application=..&campaign=..` hydrates. */
const renderFunding = (ui: ReactElement) =>
  rtlRender(
    <JourneyStoreProvider initial={{ applicationId: APPLICATION_ID, campaignId: CAMPAIGN_ID }}>{ui}</JourneyStoreProvider>
  );

function RecordedCampaign() {
  return <p data-testid="recorded-campaign">{useJourneyStore((state) => state.campaignId) ?? "none"}</p>;
}

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
    render(
      <>
        <CampaignWorkspace gateway={gateway} wallet={createWallet()} />
        <RecordedCampaign />
      </>
    );
    await connect();

    fireEvent.change(screen.getByLabelText(/Meta/), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/Fecha límite/), { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByRole("button", { name: /Abrir bóveda/i }));

    await waitFor(() => expect(gateway.openCampaign).toHaveBeenCalled());
    // The vault opens for the journey's application, not a fixed demo one.
    expect(gateway.openCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: APPLICATION_ID, smeAccountId: INVESTOR, goalStroops: 50000000n })
    );
    // The opened campaign is recorded in the journey and the view switches to it.
    await waitFor(() => expect(screen.getByTestId("recorded-campaign")).toHaveTextContent(CAMPAIGN_ID));
    expect(await screen.findByText(/Fondeo abierto/)).toBeInTheDocument();
  });
});

describe("CampaignWorkspace: without a journey application", () => {
  it("asks for the request first, and reads and opens nothing", () => {
    const gateway = createGateway();
    rtlRender(
      <JourneyStoreProvider>
        <CampaignWorkspace gateway={gateway} wallet={createWallet()} />
      </JourneyStoreProvider>
    );

    expect(screen.getByRole("status")).toHaveTextContent(/primero hay que enviar la solicitud/i);
    expect(screen.getByRole("link", { name: "Ir a la solicitud" })).toHaveAttribute("href", "/request");
    expect(screen.queryByRole("button", { name: /Abrir bóveda/i })).not.toBeInTheDocument();
    expect(gateway.getCampaign).not.toHaveBeenCalled();
    expect(gateway.openCampaign).not.toHaveBeenCalled();
  });
});

describe("CampaignWorkspace: the SME account blocked state", () => {
  it("shows the blocked-precondition message on the open panel and never renders the campaign view", async () => {
    const openCampaign = vi
      .fn()
      .mockRejectedValue(new HttpClientError("http", 422, undefined, "sme_account_unavailable"));
    const gateway = createGateway({ openCampaign });
    render(
      <>
        <CampaignWorkspace gateway={gateway} wallet={createWallet()} />
        <RecordedCampaign />
      </>
    );
    await connect();

    fireEvent.change(screen.getByLabelText(/Meta/), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/Fecha límite/), { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByRole("button", { name: /Abrir bóveda/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se abrió/i);
    expect(screen.getByTestId("recorded-campaign")).toHaveTextContent("none");
    expect(screen.getByRole("heading", { name: /Abrir bóveda de campaña/i })).toBeInTheDocument();
    expect(screen.queryByText(/Fondeo abierto|Meta alcanzada|Reembolso disponible/)).not.toBeInTheDocument();
  });
});

describe("CampaignWorkspace: the three chain states", () => {
  it("renders the funding state and offers contribute and withdraw", async () => {
    const gateway = createGateway({ getCampaign: vi.fn().mockResolvedValue(snapshot({ state: "funding" })) });
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet()} />);

    expect(await screen.findByText("Fondeo abierto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Aportar$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retirar mi aporte/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reembolsar/ })).not.toBeInTheDocument();
  });

  it("renders the settled state and hides contribute", async () => {
    const gateway = createGateway({ getCampaign: vi.fn().mockResolvedValue(snapshot({ state: "settled" })) });
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet()} />);

    expect(await screen.findByText("Meta alcanzada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Aportar$/ })).not.toBeInTheDocument();
    expect(screen.getByText(/ya no acepta aportes/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retirar mi aporte/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reembolsar/ })).not.toBeInTheDocument();
  });

  it("renders the refunding state, hides contribute, and offers refund", async () => {
    const gateway = createGateway({ getCampaign: vi.fn().mockResolvedValue(snapshot({ state: "refunding" })) });
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet()} />);

    expect(await screen.findByText("Reembolso disponible")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Aportar$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reembolsar/ })).toBeInTheDocument();
  });

  it("offers refund once the deadline has passed even while the chain still reports funding (Task #248/T4: the first permissionless refund enters `Refunding` on-chain; gating the form on state alone would make that first call unreachable from the web forever)", async () => {
    const gateway = createGateway({
      getCampaign: vi
        .fn()
        .mockResolvedValue(snapshot({ state: "funding", deadline: "2020-01-01T00:00:00.000Z" }))
    });
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet()} />);

    expect(await screen.findByText("Fondeo abierto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reembolsar/ })).toBeInTheDocument();
  });
});

describe("CampaignWorkspace: contributing", () => {
  it("opens the review with the real intent and signs nothing until Firmar en Freighter", async () => {
    const gateway = createGateway();
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet()} />);
    await connect();
    await screen.findByText("Fondeo abierto");

    fireEvent.change(screen.getByLabelText(/Monto a aportar/), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Aportar$/ }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("1.5")).toBeInTheDocument();
    expect(within(dialog).getByText("XLM")).toBeInTheDocument();
    expect(within(dialog).getByText(CONTRACT)).toBeInTheDocument();
    expect(within(dialog).getByText("contribute")).toBeInTheDocument();
    expect(within(dialog).getByText(INVESTOR)).toBeInTheDocument();
    expect(within(dialog).getByText(microcopy.testAssetNoValue)).toBeInTheDocument();
    expect(within(dialog).getByText(microcopy.preSignCheck)).toBeInTheDocument();
    const disclosure = within(dialog).getByRole("note");
    expect(within(disclosure).getByText("Firma no custodial")).toBeInTheDocument();
    expect(within(disclosure).getByText(/Freighter es la wallet/)).toBeInTheDocument();

    // Opening the review must not touch the wallet: nothing is prepared yet.
    expect(gateway.prepareInvocation).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(gateway.prepareInvocation).not.toHaveBeenCalled();
  });

  it("prevents a double submit: two rapid Firmar en Freighter clicks call prepareInvocation once", async () => {
    let resolvePrepare!: (value: unknown) => void;
    const prepareInvocation = vi.fn().mockReturnValue(new Promise((resolve) => (resolvePrepare = resolve)));
    const gateway = createGateway({ prepareInvocation });
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet()} />);
    await connect();
    await screen.findByText("Fondeo abierto");

    fireEvent.change(screen.getByLabelText(/Monto a aportar/), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Aportar$/ }));

    const signButton = within(screen.getByRole("dialog")).getByRole("button", { name: "Firmar en Freighter" });
    fireEvent.click(signButton);
    fireEvent.click(signButton);

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

  it("shows the canonical wrong-network message in the dialog and blocks signing, with no duplicate banner", async () => {
    const signTransaction = vi.fn().mockRejectedValue(new WalletError("network_mismatch", "another network"));
    const gateway = createGateway();
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet({ signTransaction })} />);
    await connect();
    await screen.findByText("Fondeo abierto");

    fireEvent.change(screen.getByLabelText(/Monto a aportar/), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Aportar$/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Firmar en Freighter" }));

    const dialog = screen.getByRole("dialog");
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(microcopy.wrongNetwork);
    expect(within(dialog).getByRole("button", { name: "Firmar en Freighter" })).toBeDisabled();
    // One error owner (D5): the dialog's alert is the only one on screen — the workspace banner
    // must not repeat it.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("shows the gateway unavailable message in the dialog when the backend refuses", async () => {
    const prepareInvocation = vi.fn().mockRejectedValue(new HttpClientError("http", 503));
    const gateway = createGateway({ prepareInvocation });
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet()} />);
    await connect();
    await screen.findByText("Fondeo abierto");

    fireEvent.change(screen.getByLabelText(/Monto a aportar/), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Aportar$/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Firmar en Freighter" }));

    const alert = await within(screen.getByRole("dialog")).findByRole("alert");
    expect(alert).toHaveTextContent(/no está disponible/i);
  });

  it("shows the reverted-contribution message in the dialog and keeps Aportar available, claiming no success", async () => {
    const getTransaction = vi.fn().mockResolvedValue({ transactionHash: HASH, status: "failed" });
    const gateway = createGateway({ getTransaction });
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet()} />);
    await connect();
    await screen.findByText("Fondeo abierto");

    fireEvent.change(screen.getByLabelText(/Monto a aportar/), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Aportar$/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Firmar en Freighter" }));

    const dialog = screen.getByRole("dialog");
    const alert = await within(dialog).findByRole("alert");
    expect(alert).not.toHaveTextContent(/éxito|confirmad/i);
    // The modal stays open for a retry, so the contribute control behind it is merely
    // aria-hidden (HeroUI's modal hides the background), never removed.
    expect(screen.getByRole("button", { name: /^Aportar$/, hidden: true })).toBeEnabled();
    expect(screen.getByText("Fondeo abierto")).toBeInTheDocument();
  });

  it("reports a missing Freighter at signing time as a rejected state, never as a success", async () => {
    const signTransaction = vi.fn().mockRejectedValue(new WalletError("unavailable", "Freighter is not available"));
    const gateway = createGateway();
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet({ signTransaction })} />);
    await connect();
    await screen.findByText("Fondeo abierto");

    fireEvent.change(screen.getByLabelText(/Monto a aportar/), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Aportar$/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Firmar en Freighter" }));

    const alert = await within(screen.getByRole("dialog")).findByRole("alert");
    expect(alert).toHaveTextContent(/instalá o habilitá freighter/i);
    expect(alert).not.toHaveTextContent(/éxito|confirmad/i);
  });
});

describe("CampaignWorkspace: Freighter absent", () => {
  it("shows an install/enable Freighter message when connect fails because the wallet is unavailable", async () => {
    const connectMock = vi.fn().mockRejectedValue(new WalletError("unavailable", "Freighter is not available"));
    const gateway = createGateway();
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet({ connect: connectMock })} />);
    await screen.findByText("Fondeo abierto");

    fireEvent.click(screen.getByRole("button", { name: /Conectar wallet/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/instalá o habilitá freighter/i);
  });
});

describe("CampaignWorkspace: the live funding-to-settled transition", () => {
  it("removes Aportar/Retirar and shows the settled copy on the same rendered section, without remounting", async () => {
    const settled = snapshot({ state: "settled", totalStroops: 50000000n });
    const getTransaction = vi
      .fn()
      .mockResolvedValue({ transactionHash: HASH, status: "success", campaign: settled });
    const gateway = createGateway({ getTransaction });
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet()} />);
    await connect();
    await screen.findByText("Fondeo abierto");

    const sectionBefore = screen.getByRole("region", { name: "Bóveda de campaña" });

    fireEvent.change(screen.getByLabelText(/Monto a aportar/), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: /^Aportar$/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Firmar en Freighter" }));

    expect(await screen.findByText("Meta alcanzada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Aportar$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retirar mi aporte/ })).not.toBeInTheDocument();
    expect(screen.getByText(/ya no acepta aportes/i)).toBeInTheDocument();

    const sectionAfter = screen.getByRole("region", { name: "Bóveda de campaña" });
    expect(sectionAfter).toBe(sectionBefore);
  });
});

describe("CampaignWorkspace: refunding", () => {
  it("sends the declared target address when refunding on behalf of another investor", async () => {
    const gateway = createGateway({ getCampaign: vi.fn().mockResolvedValue(snapshot({ state: "refunding" })) });
    renderFunding(<CampaignWorkspace gateway={gateway} wallet={createWallet()} />);
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
