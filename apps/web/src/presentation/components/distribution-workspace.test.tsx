import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { DistributionWorkspace } from "./distribution-workspace";

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
    render(<DistributionWorkspace gateway={createGateway()} wallet={createWallet()} applicationId={null} />);

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
    render(<DistributionWorkspace gateway={gateway} wallet={createWallet()} applicationId={null} />);

    fireEvent.click(screen.getByRole("button", { name: /Preparar distribución/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Conecte su wallet/i);
    expect(gateway.prepare).not.toHaveBeenCalled();
  });

  it("prepares with the connected account as source, and signs nothing until the review is acknowledged", async () => {
    const gateway = createGateway();
    const wallet = createWallet();
    render(<DistributionWorkspace gateway={gateway} wallet={wallet} applicationId={null} />);
    await connect();
    await prepare();

    expect(gateway.prepare).toHaveBeenCalledWith({
      sourceAccountId: SOURCE,
      recipients,
      memo: null,
      applicationId: null
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
      <DistributionWorkspace gateway={gateway} wallet={createWallet({ signTransaction })} applicationId={null} />
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
    render(<DistributionWorkspace gateway={createGateway()} wallet={createWallet()} applicationId={null} />);
    await connect();
    await prepare();
    acknowledgeAndSign();

    expect(await screen.findByText(/Enviada · pendiente de confirmación/i)).toBeInTheDocument();
    expect(screen.queryByText(/Confirmada en el ledger/i)).not.toBeInTheDocument();
  });

  it("transitions to confirmed when the status poll reports it", async () => {
    const confirmed = { ...snapshot, state: "confirmed" } as unknown as RevenueShareDistributionSnapshot;
    const gateway = createGateway({ getStatus: vi.fn().mockResolvedValue({ ok: true, value: confirmed }) });
    render(<DistributionWorkspace gateway={gateway} wallet={createWallet()} applicationId={null} />);
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
    render(<DistributionWorkspace gateway={gateway} wallet={createWallet()} applicationId={null} />);
    await connect();
    await prepare();
    acknowledgeAndSign();
    await screen.findByText(/pendiente de confirmación/i);

    fireEvent.click(screen.getByRole("button", { name: /Consultar estado/i }));

    expect(await screen.findByText(/Fallida/)).toBeInTheDocument();
    expect(screen.getByText(/no alcanza a cubrir el monto/i)).toBeInTheDocument();
  });
});
