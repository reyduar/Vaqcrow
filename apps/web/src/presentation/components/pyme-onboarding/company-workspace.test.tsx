import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationReviewState, MyDocument, SmeRequest, SmeRequestRead } from "@vaqcrow/contracts";
import { AI_RISK_LABELS, AI_STEP_COPY } from "@/application/pyme-onboarding/ai-step";
import type { BusinessPort, BusinessRecord } from "@/application/ports/business-port";
import type { MyCampaigns, MyCampaignsPort } from "@/application/ports/my-campaigns-port";
import type { MyDocumentsPort } from "@/application/ports/my-documents-port";
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
      load: vi.fn().mockResolvedValue({ request: SME_REQUEST, salesPeriods: [], state: "human_review" }),
      loadMine: vi.fn().mockResolvedValue({ ok: true, application: null })
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

/**
 * The post-submission state (Feature #530, S1/S2/S3/S6): «Registrar mi PyME» is
 * only for «Sin enviar»; every real state resolved from the owner-scoped read
 * hides it, including in a fresh session with no in-session submit.
 */
describe("CompanyWorkspace post-submission state (#530)", () => {
  function gatewayWith(loadMine: SmeRequestGateway["loadMine"], load?: SmeRequestGateway["load"]): SmeRequestGateway {
    return { submit: vi.fn(), load: load ?? vi.fn(), loadMine };
  }

  function renderCompany(gw: SmeRequestGateway, props: Partial<ComponentProps<typeof CompanyWorkspace>> = {}) {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CompanyWorkspace
          kyc={new FakeKyc()}
          connection={new FakeWalletConnection()}
          balance={new FakeWalletBalance()}
          myCampaigns={okMyCampaigns()}
          smeRequestGateway={gw}
          {...props}
        />
      </SWRConfig>
    );
  }

  it("resolves the application from the owner-scoped read in a fresh session and hides the button (S6, S1)", async () => {
    const load = vi.fn().mockResolvedValue({ request: SME_REQUEST, salesPeriods: [], state: "human_review" });
    const gw = gatewayWith(
      vi.fn().mockResolvedValue({ ok: true, application: { applicationId: APPLICATION_ID, state: "human_review" } }),
      load
    );

    renderCompany(gw);

    expect(await screen.findByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("En revisión");
    expect(screen.queryByRole("button", { name: "Registrar mi PyME" })).not.toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledWith(APPLICATION_ID));
  });

  it("hides the button once the campaign is approved (S2)", async () => {
    const gw = gatewayWith(
      vi.fn().mockResolvedValue({ ok: true, application: { applicationId: APPLICATION_ID, state: "approved" } })
    );
    renderCompany(gw);

    expect(await screen.findByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("Aprobada");
    expect(screen.queryByRole("button", { name: "Registrar mi PyME" })).not.toBeInTheDocument();
  });

  it.each(["changes_requested", "rejected"] as const)("hides the button for %s (S3)", async (state) => {
    const gw = gatewayWith(
      vi.fn().mockResolvedValue({ ok: true, application: { applicationId: APPLICATION_ID, state } })
    );
    renderCompany(gw);

    await waitFor(() => expect(screen.getByRole("region", { name: "Estado de tu solicitud" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Registrar mi PyME" })).not.toBeInTheDocument();
  });

  it("keeps the button and the wizard while the PyME owns no application (Sin enviar, S3)", async () => {
    const gw = gatewayWith(vi.fn().mockResolvedValue({ ok: true, application: null }));
    renderCompany(gw);

    await waitFor(() => expect(gw.loadMine).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Registrar mi PyME" }));
    expect(screen.getByRole("heading", { level: 1, name: "Verificación de identidad" })).toBeInTheDocument();
  });

  it("keeps the button while the application is still a draft (Sin enviar)", async () => {
    const gw = gatewayWith(
      vi.fn().mockResolvedValue({ ok: true, application: { applicationId: APPLICATION_ID, state: "draft" } })
    );
    renderCompany(gw);

    expect(await screen.findByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("Sin enviar");
    expect(screen.getByRole("button", { name: "Registrar mi PyME" })).toBeInTheDocument();
  });

  it("keeps the button when the owner-scoped read fails, never a service failure (#480)", async () => {
    const gw = gatewayWith(vi.fn().mockResolvedValue({ ok: false, code: "unavailable" }));
    renderCompany(gw);

    await waitFor(() => expect(gw.loadMine).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Registrar mi PyME" })).toBeInTheDocument();
  });
});

describe("captureApplicationIdOnSubmit", () => {
  it("records the application id the submit returned, then forwards the result", async () => {
    const onCaptured = vi.fn();
    const gateway: SmeRequestGateway = {
      submit: vi.fn().mockResolvedValue({ applicationId: APPLICATION_ID, request: SME_REQUEST }),
      load: vi.fn(),
      loadMine: vi.fn()
    };
    const wrapped = captureApplicationIdOnSubmit(gateway, onCaptured);

    await expect(wrapped?.submit(SME_REQUEST)).resolves.toEqual({ applicationId: APPLICATION_ID, request: SME_REQUEST });
    expect(onCaptured).toHaveBeenCalledWith(APPLICATION_ID);
  });

  it("stays null for a null gateway and forwards load and loadMine unchanged", async () => {
    expect(captureApplicationIdOnSubmit(null, vi.fn())).toBeNull();

    const load = vi.fn().mockResolvedValue({ request: SME_REQUEST, salesPeriods: [], state: "approved" });
    const loadMine = vi.fn().mockResolvedValue({ ok: true, application: null });
    const wrapped = captureApplicationIdOnSubmit({ submit: vi.fn(), load, loadMine }, vi.fn());

    await wrapped?.load(APPLICATION_ID);
    await wrapped?.loadMine();
    expect(load).toHaveBeenCalledWith(APPLICATION_ID);
    expect(loadMine).toHaveBeenCalledTimes(1);
  });
});

/**
 * The read-only «Ver lo enviado» surface (Feature #530, T5/S1/S4): offered
 * exactly when an application exists (i.e. when «Registrar mi PyME» is hidden),
 * opening an inline read-only view of what was persisted, and returning to the
 * normal `/company` view on close.
 */
describe("CompanyWorkspace «Ver lo enviado» (#530, T5)", () => {
  const REQUEST_READ: SmeRequestRead = {
    request: SME_REQUEST,
    salesPeriods: [
      { period: "2026-01", amountArs: 3_200_000, status: "reported", evidenceRef: "sales:1", simuladoLabel: "SIMULADO" }
    ],
    state: "human_review"
  };

  const BUSINESS: BusinessRecord = {
    businessId: "b1e6c2a4-9f3d-4a7b-8c1e-5d2f6a9b0c31",
    ownerUserId: "00000000-0000-4000-8000-000000000000",
    name: "Panadería Horizonte",
    cuit: "20123456789",
    sector: "Alimentos",
    city: "Córdoba",
    description: "Panadería de barrio",
    goalArs: 15_000_000,
    revenueShare: 5,
    createdAt: "2026-10-03T12:00:00.000Z",
    updatedAt: "2026-10-03T12:00:00.000Z"
  };

  const DOCUMENT: MyDocument = {
    documentId: "11111111-1111-4111-8111-111111111111",
    kind: "cuit",
    name: "constancia-cuit.pdf",
    sizeBytes: 128_512,
    contentType: "application/pdf",
    createdAt: "2026-10-03T12:00:00.000Z"
  };

  function businessPort(): BusinessPort {
    return {
      getMyBusiness: vi.fn().mockResolvedValue({ ok: true, business: BUSINESS }),
      createBusiness: vi.fn()
    } as unknown as BusinessPort;
  }

  function documentsPort(): MyDocumentsPort {
    return { listMine: vi.fn().mockResolvedValue({ ok: true, documents: [DOCUMENT] }) };
  }

  function gatewayWith(
    loadMine: SmeRequestGateway["loadMine"],
    load: SmeRequestGateway["load"] = vi.fn().mockResolvedValue(REQUEST_READ)
  ): SmeRequestGateway {
    return { submit: vi.fn(), load, loadMine };
  }

  function renderCompany(gw: SmeRequestGateway, props: Partial<ComponentProps<typeof CompanyWorkspace>> = {}) {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CompanyWorkspace
          kyc={new FakeKyc()}
          connection={new FakeWalletConnection()}
          balance={new FakeWalletBalance()}
          myCampaigns={okMyCampaigns()}
          smeRequestGateway={gw}
          business={businessPort()}
          documents={documentsPort()}
          {...props}
        />
      </SWRConfig>
    );
  }

  it("offers «Ver lo enviado» and hides «Registrar mi PyME» when an application exists (S1)", async () => {
    const gw = gatewayWith(
      vi.fn().mockResolvedValue({ ok: true, application: { applicationId: APPLICATION_ID, state: "human_review" } })
    );

    renderCompany(gw);

    expect(await screen.findByRole("button", { name: "Ver lo enviado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar mi PyME" })).not.toBeInTheDocument();
  });

  it("keeps «Registrar mi PyME» and offers no «Ver lo enviado» with no application (Sin enviar)", async () => {
    const gw = gatewayWith(vi.fn().mockResolvedValue({ ok: true, application: null }));

    renderCompany(gw);

    await waitFor(() => expect(gw.loadMine).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Registrar mi PyME" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver lo enviado" })).not.toBeInTheDocument();
  });

  it("opens the read-only panel and returns to the normal view on close", async () => {
    const gw = gatewayWith(
      vi.fn().mockResolvedValue({ ok: true, application: { applicationId: APPLICATION_ID, state: "human_review" } })
    );
    renderCompany(gw);

    fireEvent.click(await screen.findByRole("button", { name: "Ver lo enviado" }));

    const panel = screen.getByRole("region", { name: "Datos enviados de tu solicitud" });
    expect(await within(panel).findByText("Panadería Horizonte")).toBeInTheDocument();
    expect(within(panel).getByText("constancia-cuit.pdf · 125,5 KB")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Mi campaña" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver a Mi campaña" }));
    expect(screen.getByRole("heading", { level: 1, name: "Mi campaña" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Datos enviados de tu solicitud" })).not.toBeInTheDocument();
  });

  it("never presents the simulated AI risk band as submitted (S4)", async () => {
    const gw = gatewayWith(
      vi.fn().mockResolvedValue({ ok: true, application: { applicationId: APPLICATION_ID, state: "human_review" } })
    );
    renderCompany(gw);

    fireEvent.click(await screen.findByRole("button", { name: "Ver lo enviado" }));
    await screen.findByText("Panadería Horizonte");

    expect(screen.queryByText(AI_STEP_COPY.riskLabel)).not.toBeInTheDocument();
    for (const label of Object.values(AI_RISK_LABELS)) expect(screen.queryByText(label)).not.toBeInTheDocument();
    expect(screen.queryByText(/banda de riesgo/i)).not.toBeInTheDocument();
  });
});
