import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MyCampaign, MyCampaignDistribution } from "@/application/ports/my-campaigns-port";
import type { RevenueShareDistributionGateway } from "@/application/ports/revenue-share-distribution-gateway";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import type { PreparedRevenueShareDistribution, RevenueShareDistributionSnapshot } from "@vaqcrow/contracts";
import { CompanySignDistribution } from "./company-sign-distribution";

const APPLICATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const DISTRIBUTION_ID = "123e4567-e89b-42d3-a456-4266141740ab";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const PASSPHRASE = "passphrase-from-the-response";
const VAULT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2";
const ACK = "Confirmo que revisé los destinatarios y los montos";

function campaign(overrides: Partial<MyCampaign> = {}): MyCampaign {
  return {
    campaignId: CAMPAIGN_ID,
    name: "Panadería Horizonte",
    sector: "Alimentos",
    city: "Córdoba",
    imageSrc: null,
    vaultAddress: VAULT,
    state: "settled",
    goalArs: 15_000_000,
    raisedArs: 15_000_000,
    fundedPercentBps: 10_000,
    deadline: "2026-11-30T12:00:00.000Z",
    contributorsCount: 38,
    distributions: [],
    sales: [],
    ...overrides
  };
}

function distribution(overrides: Partial<MyCampaignDistribution> = {}): MyCampaignDistribution {
  return {
    distributionId: DISTRIBUTION_ID,
    period: "2026-08",
    amountArs: 168_561,
    amountXlm: "1.2500000",
    state: "submitted",
    ...overrides
  };
}

const prepared = {
  distributionId: DISTRIBUTION_ID,
  network: "testnet",
  networkPassphrase: PASSPHRASE,
  sourceAccountId: SOURCE,
  sourceSequence: "1234567891",
  recipients: [{ accountId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", amountStroops: 33_712_200n }],
  memo: null,
  expiresAt: "2026-09-21T12:15:00.000Z",
  xdr: "UNSIGNED-XDR",
  applicationId: APPLICATION_ID,
  campaignId: CAMPAIGN_ID,
  derivation: {
    ruleVersion: "RS-2026-01",
    rateBps: 450,
    period: "2026-08",
    salesArs: "3745800",
    obligationArs: "168561",
    excludedPeriods: [],
    conversion: { goalStroops: "1000000000", approvedLimitArs: "5000000", totalStroops: "33712200" },
    simulated: true
  }
} as unknown as PreparedRevenueShareDistribution;

const snapshot = {
  ...prepared,
  state: "submitted",
  transactionHash: "TRANSACTION-HASH",
  explorerUrl: "https://stellar.expert/explorer/testnet/tx/TRANSACTION-HASH",
  failureReason: null,
  lastCorrelationId: CORRELATION_ID,
  period: "2026-08",
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
} as unknown as RevenueShareDistributionSnapshot;

function createGateway(overrides: Partial<RevenueShareDistributionGateway> = {}): RevenueShareDistributionGateway {
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
    signMessage: vi.fn().mockResolvedValue("SIGNATURE"),
    ...overrides
  } as unknown as WalletPort;
}

function createConnection(): WalletConnectionPort {
  return {
    requestChallenge: vi.fn(),
    submitConnection: vi.fn(),
    getConnection: vi.fn().mockResolvedValue({ ok: true, publicKey: SOURCE, frozen: false })
  } as unknown as WalletConnectionPort;
}

function renderAction(overrides: Partial<Parameters<typeof CompanySignDistribution>[0]> = {}) {
  const gateway = overrides.gateway === undefined ? createGateway() : overrides.gateway;
  const wallet = overrides.wallet === undefined ? createWallet() : overrides.wallet;
  const connection = overrides.connection === undefined ? createConnection() : overrides.connection;
  const onSigned = overrides.onSigned ?? vi.fn();
  const ui = render(
    <CompanySignDistribution
      campaign={overrides.campaign ?? campaign()}
      distribution={overrides.distribution ?? distribution()}
      applicationId={overrides.applicationId ?? APPLICATION_ID}
      gateway={gateway}
      wallet={wallet}
      connection={connection}
      onSigned={onSigned}
      {...(overrides.autoStart ? { autoStart: true } : {})}
    />
  );
  return { ...ui, gateway: gateway as RevenueShareDistributionGateway, wallet, connection, onSigned };
}

async function openAndSign() {
  fireEvent.click(screen.getByRole("button", { name: "Revisar y firmar" }));
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("checkbox", { name: ACK }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Firmar en Freighter" }));
}

describe("CompanySignDistribution", () => {
  it("offers the review action and prepares nothing until it is pressed", () => {
    const { gateway } = renderAction();
    expect(screen.getByRole("button", { name: "Revisar y firmar" })).toBeInTheDocument();
    expect(gateway.prepare).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the contract, the function and the custody rule plus the amount before signing", async () => {
    renderAction();
    fireEvent.click(screen.getByRole("button", { name: "Revisar y firmar" }));

    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Contrato")).toBeInTheDocument();
    expect(dialog.getByText(VAULT)).toBeInTheDocument();
    expect(dialog.getByText("Función")).toBeInTheDocument();
    expect(dialog.getByText("Custodia")).toBeInTheDocument();
    expect(dialog.getAllByText(/3\.37122/).length).toBeGreaterThan(0);
  });

  it("signs in Freighter with the service's passphrase and submits, then shows sent — never confirmed", async () => {
    const { gateway, wallet, onSigned } = renderAction();
    await openAndSign();

    await waitFor(() => expect(wallet.signTransaction).toHaveBeenCalledWith("UNSIGNED-XDR", PASSPHRASE));
    await waitFor(() => expect(gateway.submit).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Enviada · pendiente de confirmación/i)).toBeInTheDocument();
    expect(screen.queryByText(/Confirmada en el ledger/i)).not.toBeInTheDocument();
    expect(onSigned).toHaveBeenCalledTimes(1);
  });

  it("never reaches the wallet when the service refuses the preparation", async () => {
    const gateway = createGateway({ prepare: vi.fn().mockResolvedValue({ ok: false, error: { kind: "not_found" } }) });
    const { wallet } = renderAction({ gateway });
    fireEvent.click(screen.getByRole("button", { name: "Revisar y firmar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/No se encontró la distribución/i);
    expect(wallet.signTransaction).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts the review on mount when the dashboard's list button is the trigger", async () => {
    const { gateway } = renderAction({ autoStart: true });
    await screen.findByRole("dialog");
    expect(gateway.prepare).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Revisar y firmar" })).not.toBeInTheDocument();
  });

  it("shows the failed terminal state with the contract's own reason", async () => {
    const failed = { ...snapshot, state: "failed", failureReason: "insufficient_balance" } as unknown as RevenueShareDistributionSnapshot;
    const gateway = createGateway({ getStatus: vi.fn().mockResolvedValue({ ok: true, value: failed }) });
    renderAction({ gateway });
    await openAndSign();
    await screen.findByText(/Enviada · pendiente de confirmación/i);

    fireEvent.click(screen.getByRole("button", { name: /Consultar estado/i }));

    expect(await screen.findByText(/Fallida/)).toBeInTheDocument();
    expect(screen.getByText(/no alcanza a cubrir el monto/i)).toBeInTheDocument();
  });
});
