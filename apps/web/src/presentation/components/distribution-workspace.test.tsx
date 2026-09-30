import { fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  demoDistributionRecipients,
  SIMULADO_DISTRIBUTION_LABEL
} from "@/application/distribution/demo-distribution-recipients";
import type { RevenueShareDistributionGateway } from "@/application/ports/revenue-share-distribution-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { WalletError } from "@/application/ports/wallet-port";
import type {
  PreparedRevenueShareDistribution,
  RevenueShareDistributionSnapshot
} from "@vaqcrow/contracts";
import { JourneyStoreProvider, useJourneyStore } from "@/state/journey-store-provider";
import { DistributionWorkspace } from "./distribution-workspace";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAMPAIGN_ID = "40000000-0000-4000-8000-000000000000";

/** The journey as funding leaves it: an application and its campaign. */
const render = (ui: ReactElement) =>
  rtlRender(
    <JourneyStoreProvider initial={{ applicationId: APPLICATION_ID, campaignId: CAMPAIGN_ID }}>{ui}</JourneyStoreProvider>
  );

function RecordedDistribution() {
  return <p data-testid="recorded-distribution">{useJourneyStore((state) => state.distributionId) ?? "none"}</p>;
}

const DISTRIBUTION_ID = "123e4567-e89b-42d3-a456-4266141740ab";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const PASSPHRASE = "passphrase-from-the-response";
const ACK = "Confirmo que revisé los destinatarios y los montos";

const recipients = demoDistributionRecipients.recipients.map((recipient) => ({
  accountId: recipient.accountId,
  amountStroops: recipient.amountStroops
}));

const prepared = {
  distributionId: DISTRIBUTION_ID,
  network: "testnet",
  networkPassphrase: PASSPHRASE,
  sourceAccountId: SOURCE,
  sourceSequence: "1234567891",
  recipients,
  memo: null,
  expiresAt: "2026-09-21T12:15:00.000Z",
  xdr: "UNSIGNED-XDR",
  applicationId: null
} as unknown as PreparedRevenueShareDistribution;

const snapshot = {
  ...prepared,
  state: "submitted",
  transactionHash: "TRANSACTION-HASH",
  explorerUrl: "https://stellar.expert/explorer/testnet/tx/TRANSACTION-HASH",
  failureReason: null,
  lastCorrelationId: CORRELATION_ID,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
} as unknown as RevenueShareDistributionSnapshot;

function createGateway(
  overrides: Partial<RevenueShareDistributionGateway> = {}
): RevenueShareDistributionGateway {
  return {
    prepare: vi.fn().mockResolvedValue({ ok: true, value: prepared }),
    submit: vi.fn().mockResolvedValue({ ok: true, value: { applied: true, distribution: snapshot } }),
    getStatus: vi.fn().mockResolvedValue({ ok: true, value: snapshot }),
    ...overrides
  } as unknown as RevenueShareDistributionGateway;
}

function createWallet(overrides: Partial<WalletPort> = {}): WalletPort {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    connect: vi.fn().mockResolvedValue({ publicKey: SOURCE }),
    signTransaction: vi.fn().mockResolvedValue("SIGNED-XDR"),
    ...overrides
  } as unknown as WalletPort;
}

async function connect() {
  fireEvent.click(screen.getByRole("button", { name: /Conectar wallet/i }));
  await screen.findByText(/Wallet conectada/i);
}

async function prepare() {
  fireEvent.click(screen.getByRole("button", { name: /Preparar distribución/i }));
  await screen.findByRole("dialog");
}

function acknowledgeAndSign() {
  fireEvent.click(screen.getByRole("checkbox", { name: ACK }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Firmar en Freighter" }));
}

describe("DistributionWorkspace", () => {
  it("labels every synthetic recipient and the demo rule version as SIMULADO", () => {
    render(<DistributionWorkspace gateway={createGateway()} wallet={createWallet()} />);

    expect(screen.getAllByText(SIMULADO_DISTRIBUTION_LABEL).length).toBeGreaterThanOrEqual(
      demoDistributionRecipients.recipients.length
    );
    for (const recipient of demoDistributionRecipients.recipients) {
      expect(screen.getByText(recipient.accountId)).toBeInTheDocument();
    }
    expect(screen.getByText(demoDistributionRecipients.ruleVersion)).toBeInTheDocument();
  });

  it("refuses to prepare without a connected wallet and never calls the gateway", async () => {
    const gateway = createGateway();
    render(<DistributionWorkspace gateway={gateway} wallet={createWallet()} />);

    fireEvent.click(screen.getByRole("button", { name: /Preparar distribución/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Conecte su wallet/i);
    expect(gateway.prepare).not.toHaveBeenCalled();
  });

  it("prepares for the journey application with the connected account as source, and signs nothing until the review is acknowledged", async () => {
    const gateway = createGateway();
    const wallet = createWallet();
    render(<DistributionWorkspace gateway={gateway} wallet={wallet} />);
    await connect();
    await prepare();

    expect(gateway.prepare).toHaveBeenCalledWith({
      sourceAccountId: SOURCE,
      recipients,
      memo: null,
      applicationId: APPLICATION_ID
    });
    expect(wallet.signTransaction).not.toHaveBeenCalled();
    expect(within(screen.getByRole("dialog")).getByText(demoDistributionRecipients.ruleVersion)).toBeInTheDocument();

    acknowledgeAndSign();

    await waitFor(() =>
      expect(wallet.signTransaction).toHaveBeenCalledWith("UNSIGNED-XDR", PASSPHRASE)
    );
  });

  it("surfaces a rejected signature truthfully and keeps the prepared distribution for a retry", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValueOnce(new WalletError("rejected", "The user rejected this request."))
      .mockResolvedValueOnce("SIGNED-XDR");
    const gateway = createGateway();
    render(
      <DistributionWorkspace gateway={gateway} wallet={createWallet({ signTransaction })} />
    );
    await connect();
    await prepare();
    acknowledgeAndSign();

    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent(
      /Rechazó la firma/i
    );

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Firmar en Freighter" }));

    await waitFor(() => expect(gateway.submit).toHaveBeenCalledTimes(1));
    expect(gateway.prepare).toHaveBeenCalledTimes(1);
  });

  it("shows the submitted state after a successful submit, never confirmed", async () => {
    render(<DistributionWorkspace gateway={createGateway()} wallet={createWallet()} />);
    await connect();
    await prepare();
    acknowledgeAndSign();

    expect(await screen.findByText(/Enviada · pendiente de confirmación/i)).toBeInTheDocument();
    expect(screen.queryByText(/Confirmada en el ledger/i)).not.toBeInTheDocument();
  });

  it("transitions to confirmed when the status poll reports it", async () => {
    const confirmed = { ...snapshot, state: "confirmed" } as unknown as RevenueShareDistributionSnapshot;
    const gateway = createGateway({ getStatus: vi.fn().mockResolvedValue({ ok: true, value: confirmed }) });
    render(<DistributionWorkspace gateway={gateway} wallet={createWallet()} />);
    await connect();
    await prepare();
    acknowledgeAndSign();
    await screen.findByText(/pendiente de confirmación/i);

    fireEvent.click(screen.getByRole("button", { name: /Consultar estado/i }));

    expect(await screen.findByText(/Confirmada en el ledger/i)).toBeInTheDocument();
  });

  it("shows the failed terminal state with the contract's own failure reason", async () => {
    const failed = {
      ...snapshot,
      state: "failed",
      failureReason: "insufficient_balance"
    } as unknown as RevenueShareDistributionSnapshot;
    const gateway = createGateway({ getStatus: vi.fn().mockResolvedValue({ ok: true, value: failed }) });
    render(<DistributionWorkspace gateway={gateway} wallet={createWallet()} />);
    await connect();
    await prepare();
    acknowledgeAndSign();
    await screen.findByText(/pendiente de confirmación/i);

    fireEvent.click(screen.getByRole("button", { name: /Consultar estado/i }));

    expect(await screen.findByText(/Fallida/)).toBeInTheDocument();
    expect(screen.getByText(/no alcanza a cubrir el monto/i)).toBeInTheDocument();
  });

  it("records the distribution id in the journey as soon as the prepare answer carries it", async () => {
    render(
      <>
        <DistributionWorkspace gateway={createGateway()} wallet={createWallet()} />
        <RecordedDistribution />
      </>
    );
    await connect();
    await prepare();

    expect(screen.getByTestId("recorded-distribution")).toHaveTextContent(DISTRIBUTION_ID);
  });

  it("shows the journey's distribution id as the current reference", () => {
    rtlRender(
      <JourneyStoreProvider
        initial={{ applicationId: APPLICATION_ID, campaignId: CAMPAIGN_ID, distributionId: DISTRIBUTION_ID }}
      >
        <DistributionWorkspace gateway={createGateway()} wallet={createWallet()} />
      </JourneyStoreProvider>
    );

    expect(screen.getByText(DISTRIBUTION_ID)).toBeInTheDocument();
  });

  it("asks for the request first, and prepares nothing, when the journey has no application", () => {
    const gateway = createGateway();
    rtlRender(
      <JourneyStoreProvider>
        <DistributionWorkspace gateway={gateway} wallet={createWallet()} />
      </JourneyStoreProvider>
    );

    expect(screen.getByRole("status")).toHaveTextContent(/primero hay que enviar la solicitud/i);
    expect(screen.getByRole("link", { name: "Ir a la solicitud" })).toHaveAttribute("href", "/request");
    expect(screen.queryByRole("button", { name: /Conectar wallet/i })).not.toBeInTheDocument();
    expect(gateway.prepare).not.toHaveBeenCalled();
  });

  it("still prepares and submits without a campaign, but records no distribution the journey cannot hold", async () => {
    const gateway = createGateway();
    rtlRender(
      <JourneyStoreProvider initial={{ applicationId: APPLICATION_ID }}>
        <DistributionWorkspace gateway={gateway} wallet={createWallet()} />
        <RecordedDistribution />
      </JourneyStoreProvider>
    );
    await connect();
    await prepare();
    acknowledgeAndSign();

    await screen.findByText(/Enviada · pendiente de confirmación/i);
    expect(gateway.submit).toHaveBeenCalled();
    expect(screen.getByTestId("recorded-distribution")).toHaveTextContent("none");
  });
});
