import { fireEvent, render, screen, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationReviewState, SmeRequest } from "@vaqcrow/contracts";
import type { MyCampaigns, MyCampaignsPort } from "@/application/ports/my-campaigns-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { FakeKyc } from "@/test/fake-kyc";
import { FakeWallet, FakeWalletBalance, FakeWalletConnection } from "@/test/fake-wallet";
import { CompanyWorkspace, captureApplicationIdOnSubmit } from "./company-workspace";

const PUBLIC_KEY = "GBXK1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ2345677Q2M";
const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

const SME_REQUEST: SmeRequest = {
  smeReference: "sme:T",
  declaredTotalArs: 100,
  periodStart: "2026-01",
  periodEnd: "2026-02",
  simuladoLabel: "SIMULADO"
};

function myCampaigns(): MyCampaigns {
  return {
    campaigns: [
      {
        campaignId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10",
        name: "Campaña 2026 · Panadería Horizonte",
        sector: "Alimentos",
        city: "Córdoba",
        imageSrc: null,
        vaultAddress: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2",
        vaultExplorerUrl: null,
        state: "funding",
        goalArs: 15_000_000,
        raisedArs: 9_450_000,
        fundedPercentBps: 6_300,
        deadline: "2026-11-30T12:00:00.000Z",
        contributorsCount: 38,
        distributions: [],
        sales: []
      }
    ]
  };
}

function okMyCampaigns(value: MyCampaigns = myCampaigns()): MyCampaignsPort {
  return { get: async () => ({ ok: true, myCampaigns: value }) };
}

function renderWorkspace(
  connection = new FakeWalletConnection(),
  myCampaignPort = okMyCampaigns(),
  applicationState?: ApplicationReviewState | null
) {
  render(
    <CompanyWorkspace
      kyc={new FakeKyc()}
      connection={connection}
      balance={new FakeWalletBalance()}
      myCampaigns={myCampaignPort}
      {...(applicationState === undefined ? {} : { applicationState })}
    />
  );
  return connection;
}

describe("CompanyWorkspace", () => {
  it("shows the PyME dashboard skeleton with an active 'Registrar mi PyME' action", () => {
    renderWorkspace();

    expect(screen.getByRole("heading", { level: 1, name: "Mi campaña" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Estado de la bóveda de tu campaña y las distribuciones que tenés que firmar. Todo corre en Stellar Testnet con datos sintéticos."
      )
    ).toBeInTheDocument();

    const register = screen.getByRole("button", { name: "Registrar mi PyME" });
    expect(register).toBeEnabled();
    expect(register).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByRole("link", { name: "Registrar mi PyME" })).not.toBeInTheDocument();
  });

  it("renders the Mi campaña dashboard alongside the register action", async () => {
    renderWorkspace();

    expect(await screen.findByRole("heading", { name: "Bóveda y distribuciones" })).toBeInTheDocument();
    expect(screen.getByText("Fondeado")).toBeInTheDocument();
    expect(screen.getByText("ARS 9.450.000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar mi PyME" })).toBeInTheDocument();
  });

  it("opens the wizard in place and returns to the dashboard with Volver", () => {
    renderWorkspace();

    screen.getByRole("button", { name: "Registrar mi PyME" });
    fireEvent.click(screen.getByRole("button", { name: "Registrar mi PyME" }));
    expect(screen.getByRole("heading", { level: 1, name: "Verificación de identidad" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Mi campaña" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver a la pantalla anterior" }));
    expect(screen.getByRole("heading", { level: 1, name: "Mi campaña" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Verificación de identidad" })).not.toBeInTheDocument();
  });

  it("shows no wallet card while no account is linked", () => {
    renderWorkspace();

    expect(screen.queryByRole("heading", { name: "Freighter conectada de forma no custodial" })).not.toBeInTheDocument();
  });

  it("shows the wallet card once an account is linked and reads its balance", async () => {
    const connection = new FakeWalletConnection();
    connection.seedConnection(PUBLIC_KEY);
    const balance = new FakeWalletBalance();
    balance.seedBalance("12.5000000");
    render(
      <CompanyWorkspace
        kyc={new FakeKyc()}
        connection={connection}
        balance={balance}
        myCampaigns={okMyCampaigns()}
      />
    );

    const card = await screen.findByRole("region", { name: "Freighter conectada de forma no custodial" });
    expect(within(card).getByText("STELLAR TESTNET")).toBeInTheDocument();
    expect(within(card).getByText("Saldo disponible")).toBeInTheDocument();
    expect(within(card).getByText("12,5000000 XLM")).toBeInTheDocument();
    expect(within(card).getByText("Activo de prueba sin valor económico")).toBeInTheDocument();
    expect(within(card).getByText("GBXK…7Q2M")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /explorador de Stellar Testnet/i })).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/account/${PUBLIC_KEY}`
    );
  });

  it("offers «Conectar Freighter» in the funds guide while no wallet is linked", () => {
    renderWorkspace();

    const guide = screen.getByRole("region", { name: "Guía para fondear tu wallet de Testnet" });
    expect(within(guide).getByRole("heading", { name: "Fondear tu wallet con XLM de prueba" })).toBeInTheDocument();
    expect(within(guide).getByRole("button", { name: "Conectar Freighter" })).toBeInTheDocument();
    expect(within(guide).queryByRole("link", { name: /Friendbot/i })).not.toBeInTheDocument();
    expect(within(guide).getByText(/Vaqcrow no custodia fondos ni mueve dinero/i)).toBeInTheDocument();
  });

  it("connects Freighter from the funds guide and then shows the funded balance", async () => {
    const wallet = new FakeWallet();
    wallet.seedAccount(PUBLIC_KEY);
    const balance = new FakeWalletBalance();
    balance.seedBalance("12.5000000");
    render(
      <CompanyWorkspace
        kyc={new FakeKyc()}
        walletPort={wallet}
        connection={new FakeWalletConnection()}
        balance={balance}
        myCampaigns={okMyCampaigns()}
      />
    );

    const guide = screen.getByRole("region", { name: "Guía para fondear tu wallet de Testnet" });
    fireEvent.click(within(guide).getByRole("button", { name: "Conectar Freighter" }));

    expect(await within(guide).findByText("12,5000000 XLM")).toBeInTheDocument();
    expect(within(guide).getByText(/ya tiene XLM de Testnet para pagar la creación de la bóveda/i)).toBeInTheDocument();
  });

  it("shows the sanitized connect failure when Freighter is not available", async () => {
    render(
      <CompanyWorkspace
        kyc={new FakeKyc()}
        walletPort={new FakeWallet()}
        connection={new FakeWalletConnection()}
        balance={new FakeWalletBalance()}
        myCampaigns={okMyCampaigns()}
      />
    );

    const guide = screen.getByRole("region", { name: "Guía para fondear tu wallet de Testnet" });
    fireEvent.click(within(guide).getByRole("button", { name: "Conectar Freighter" }));

    expect(await within(guide).findByRole("alert")).toHaveTextContent(
      "No encontramos Freighter en este navegador."
    );
  });

  it("shows the connected balance and prefills Friendbot while the account is unfunded", async () => {
    const connection = new FakeWalletConnection();
    connection.seedConnection(PUBLIC_KEY);
    renderWorkspace(connection);

    const guide = await screen.findByRole("region", { name: "Guía para fondear tu wallet de Testnet" });
    expect(await within(guide).findByText("0,0000000 XLM")).toBeInTheDocument();
    expect(within(guide).getByRole("link", { name: /Friendbot/i })).toHaveAttribute(
      "href",
      `https://friendbot.stellar.org/?addr=${PUBLIC_KEY}`
    );
  });

  it("renders the application state banner when the state is supplied", () => {
    renderWorkspace(new FakeWalletConnection(), okMyCampaigns(), "human_review");

    expect(screen.getByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("En revisión");
  });

  it("omits the application state banner when the state was not read", () => {
    renderWorkspace();

    expect(screen.queryByRole("region", { name: "Estado de tu solicitud" })).not.toBeInTheDocument();
  });

  it("renders the application state banner from the sme-request read", async () => {
    const gateway: SmeRequestGateway = {
      submit: vi.fn(),
      load: vi.fn().mockResolvedValue({ request: SME_REQUEST, salesPeriods: [], state: "human_review" })
    };
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CompanyWorkspace
          kyc={new FakeKyc()}
          connection={new FakeWalletConnection()}
          balance={new FakeWalletBalance()}
          myCampaigns={okMyCampaigns()}
          applicationId={APPLICATION_ID}
          smeRequestGateway={gateway}
        />
      </SWRConfig>
    );

    expect(await screen.findByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("En revisión");
    expect(gateway.load).toHaveBeenCalledWith(APPLICATION_ID);
  });
});

describe("captureApplicationIdOnSubmit", () => {
  it("records the application id the submit returned, then forwards the result", async () => {
    const onCaptured = vi.fn();
    const gateway: SmeRequestGateway = {
      submit: vi.fn().mockResolvedValue({ applicationId: APPLICATION_ID, request: SME_REQUEST }),
      load: vi.fn()
    };
    const wrapped = captureApplicationIdOnSubmit(gateway, onCaptured);

    await expect(wrapped?.submit(SME_REQUEST)).resolves.toEqual({ applicationId: APPLICATION_ID, request: SME_REQUEST });
    expect(onCaptured).toHaveBeenCalledWith(APPLICATION_ID);
  });

  it("stays null for a null gateway and forwards load unchanged", async () => {
    expect(captureApplicationIdOnSubmit(null, vi.fn())).toBeNull();

    const load = vi.fn().mockResolvedValue({ request: SME_REQUEST, salesPeriods: [], state: "approved" });
    const wrapped = captureApplicationIdOnSubmit({ submit: vi.fn(), load }, vi.fn());

    await wrapped?.load(APPLICATION_ID);
    expect(load).toHaveBeenCalledWith(APPLICATION_ID);
  });
});
