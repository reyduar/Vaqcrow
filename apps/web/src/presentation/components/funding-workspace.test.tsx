import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FundingIntentGateway } from "@/application/ports/funding-intent-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { WalletError } from "@/application/ports/wallet-port";
import type { FundingIntentSnapshot, PreparedFundingIntent } from "@vaqcrow/contracts";
import { FundingWorkspace } from "./funding-workspace";

const INTENT_ID = "11111111-1111-4111-8111-111111111111";
const CORRELATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SOURCE = "GSOURCEACCOUNT";
const DEST = "GDESTINATIONACCOUNT";

const prepared = {
  intentId: INTENT_ID,
  network: "TESTNET",
  networkPassphrase: "passphrase-from-the-response",
  sourceAccountId: SOURCE,
  sourceSequence: "12",
  destinationAccountId: DEST,
  amountStroops: 15000000n,
  memo: null,
  expiresAt: "2026-09-21T12:15:00.000Z",
  xdr: "UNSIGNED-XDR",
  applicationId: null
} as unknown as PreparedFundingIntent;

const snapshot = {
  intentId: INTENT_ID,
  network: "TESTNET",
  networkPassphrase: "passphrase-from-the-response",
  sourceAccountId: SOURCE,
  sourceSequence: "12",
  destinationAccountId: DEST,
  amountStroops: 15000000n,
  memo: null,
  expiresAt: "2026-09-21T12:15:00.000Z",
  state: "submitted",
  transactionHash: "TRANSACTION-HASH",
  applicationId: null,
  explorerUrl: "https://stellar.expert/explorer/testnet/tx/TRANSACTION-HASH",
  failureReason: null,
  lastCorrelationId: CORRELATION_ID,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:00.000Z"
} as unknown as FundingIntentSnapshot;

function createGateway(overrides: Partial<FundingIntentGateway> = {}): FundingIntentGateway {
  return {
    prepare: vi.fn().mockResolvedValue(prepared),
    submit: vi.fn().mockResolvedValue({ applied: true, intent: snapshot }),
    get: vi.fn().mockResolvedValue(snapshot),
    ...overrides
  } as unknown as FundingIntentGateway;
}

function createWallet(overrides: Partial<WalletPort> = {}): WalletPort {
  return {
    isAvailable: vi.fn().mockResolvedValue(true),
    connect: vi.fn().mockResolvedValue({ publicKey: SOURCE }),
    signTransaction: vi.fn().mockResolvedValue("SIGNED-XDR"),
    ...overrides
  } as unknown as WalletPort;
}

async function fillAndConnect() {
  fireEvent.click(screen.getByRole("button", { name: /Conectar wallet/i }));
  await screen.findByText(/Wallet conectada/i);
}

function fillForm(amount = "1.5") {
  fireEvent.change(screen.getByLabelText(/Cuenta de destino/), { target: { value: DEST } });
  fireEvent.change(screen.getByLabelText(/Monto/), { target: { value: amount } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Firmar y enviar/ }));
}

describe("FundingWorkspace", () => {
  it("refuses an over-precise amount before calling the gateway", async () => {
    const gateway = createGateway();
    render(<FundingWorkspace gateway={gateway} wallet={createWallet()} applicationId={null} />);
    await fillAndConnect();

    fillForm("1.23456789");
    submit();

    expect(await screen.findByText(/7 decimales/i)).toBeInTheDocument();
    expect(gateway.prepare).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a recoverable signing failure and lets the person retry without re-preparing", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValueOnce(new WalletError("rejected", "The user rejected this request."))
      .mockResolvedValueOnce("SIGNED-XDR");
    const prepare = vi.fn().mockResolvedValue(prepared);
    const gateway = createGateway({ prepare });
    render(
      <FundingWorkspace gateway={gateway} wallet={createWallet({ signTransaction })} applicationId={null} />
    );
    await fillAndConnect();
    fillForm();

    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Rechazaste la firma/i);

    submit();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Env[ií]o registrado/i));
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("shows the submitted state with the server transaction hash", async () => {
    render(<FundingWorkspace gateway={createGateway()} wallet={createWallet()} applicationId={null} />);
    await fillAndConnect();
    fillForm();

    submit();

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/Env[ií]o registrado/i);
    expect(screen.getByText("TRANSACTION-HASH")).toBeInTheDocument();
  });

  it("shows the explorer link the server supplied, rather than composing one", async () => {
    render(<FundingWorkspace gateway={createGateway()} wallet={createWallet()} applicationId={null} />);
    await fillAndConnect();
    fillForm();

    submit();

    // The third acceptance criterion. The href is asserted against the snapshot's
    // own value on purpose: the browser must render where the API pointed, not
    // rebuild the link from a network convention it would have to know.
    const link = await screen.findByRole("link", { name: /explorador/i });
    expect(link).toHaveAttribute("href", snapshot.explorerUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("shows why a failed transaction failed, in words and in the contract's own value", async () => {
    const failed = { ...snapshot, state: "failed" as const, failureReason: "insufficient_balance" as const };
    const gateway = createGateway({
      submit: vi.fn().mockResolvedValue({ applied: true, intent: failed })
    });
    render(<FundingWorkspace gateway={gateway} wallet={createWallet()} applicationId={null} />);
    await fillAndConnect();
    fillForm();

    submit();

    expect(await screen.findByText(/no alcanza a cubrir el monto/i)).toBeInTheDocument();
    expect(screen.getByText("insufficient_balance")).toBeInTheDocument();
  });

  it("shows no failure reason while the intent has not failed", async () => {
    render(<FundingWorkspace gateway={createGateway()} wallet={createWallet()} applicationId={null} />);
    await fillAndConnect();
    fillForm();

    submit();

    await screen.findByRole("status");
    expect(screen.queryByText(/Motivo del fallo/i)).not.toBeInTheDocument();
  });

  it("distinguishes an exact replay from a first submission", async () => {
    const gateway = createGateway({
      submit: vi.fn().mockResolvedValue({ applied: false, intent: snapshot })
    });
    render(<FundingWorkspace gateway={gateway} wallet={createWallet()} applicationId={null} />);
    await fillAndConnect();
    fillForm();

    submit();

    expect(await screen.findByRole("status")).toHaveTextContent(/ya estaba registrado/i);
  });

  it("fails explicitly when no backend is configured", async () => {
    render(<FundingWorkspace gateway={null} wallet={createWallet()} applicationId={null} />);
    await fillAndConnect();
    fillForm();

    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/no está disponible/i);
  });
});
