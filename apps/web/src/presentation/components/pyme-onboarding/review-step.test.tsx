import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { SmeRequest } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { BusinessDraft } from "@/application/ports/business-port";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { DEMO_VALUES } from "@/application/pyme-onboarding/registration-step";
import { FakeBusiness, fakeBusinessRecord } from "@/test/fake-business";
import { FakeWallet, FakeWalletConnection } from "@/test/fake-wallet";
import { ReviewStep } from "./review-step";

const APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const REQUEST: SmeRequest = {
  smeReference: "30712345678",
  declaredTotalArs: 27138250,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

const DRAFT: BusinessDraft = {
  name: "Panadería Horizonte SRL",
  cuit: "30712345678",
  sector: "Alimentos",
  city: "Córdoba",
  description: DEMO_VALUES.desc,
  goalArs: 15000000,
  revenueShare: 4.5
};

function gateway(overrides: Partial<SmeRequestGateway> = {}): SmeRequestGateway {
  return {
    submit: vi.fn().mockResolvedValue({ applicationId: APPLICATION_ID, request: REQUEST }),
    load: vi.fn(),
    ...overrides
  };
}

function renderReview(props: Partial<React.ComponentProps<typeof ReviewStep>> = {}) {
  const onEdit = vi.fn();
  const onDone = vi.fn();
  const wallet = props.wallet ?? new FakeWallet();
  const gw = props.gateway === undefined ? gateway() : props.gateway;
  const business = props.business ?? new FakeBusiness();
  const connection = props.connection ?? new FakeWalletConnection();
  render(
    <ReviewStep
      wallet={wallet}
      gateway={gw}
      business={business}
      connection={connection}
      values={DEMO_VALUES}
      onEdit={onEdit}
      onDone={onDone}
      {...props}
    />
  );
  return { onEdit, onDone, wallet, gw, business, connection };
}

function nextStepRows(): HTMLElement[] {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

describe("ReviewStep before sending", () => {
  it("renders the not-sent banner, the heading and the five template steps", () => {
    renderReview();

    expect(screen.getByText("Revisá y enviá tu solicitud.")).toBeInTheDocument();
    expect(screen.getByText(/Todavía no fue enviada a revisión\./)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Qué pasa ahora" })).toBeInTheDocument();

    const rows = nextStepRows();
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent("Solicitud lista");
    expect(rows[0]).toHaveTextContent("Pendiente");
    expect(rows[3]).toHaveTextContent("Revisión humana");
    expect(rows[3]).toHaveTextContent("Pendiente");

    expect(screen.getByRole("button", { name: /Enviar a revisión/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar lo cargado" })).toBeInTheDocument();
  });

  it("returns to step 2 with Revisar lo cargado", () => {
    const { onEdit } = renderReview();
    fireEvent.click(screen.getByRole("button", { name: "Revisar lo cargado" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe("ReviewStep wallet gate", () => {
  it("turns the wallet step red and blocks sending without a connected wallet", () => {
    const gw = gateway();
    renderReview({ gateway: gw });
    const rows = nextStepRows();

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));

    expect(rows[2]).toHaveTextContent("Obligatorio");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Conectá tu wallet Freighter para poder enviar la solicitud a revisión."
    );
    expect(gw.submit).not.toHaveBeenCalled();
  });

  it("connects Freighter, persists the key, and then sends the mapped request", async () => {
    const wallet = new FakeWallet();
    wallet.seedAccount("GBXK1234567890ABCD7Q2M");
    const gw = gateway();
    const connection = new FakeWalletConnection();
    const { onDone } = renderReview({ wallet, gateway: gw, connection });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });

    // The key is signed and stored through the connection port, not just held
    // in component state.
    expect(connection.submitted).toEqual([
      {
        challengeId: expect.any(String),
        publicKey: "GBXK1234567890ABCD7Q2M",
        signature: expect.stringContaining("fake-signature")
      }
    ]);
    expect(connection.challengeCalls).toBe(1);
    expect(wallet.signedMessages).toHaveLength(1);

    expect(screen.queryByText("Obligatorio")).not.toBeInTheDocument();
    expect(nextStepRows()[2]).toHaveTextContent("Completo");
    expect(nextStepRows()[2]).toHaveTextContent("GBXK…7Q2M");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });

    expect(gw.submit).toHaveBeenCalledWith(REQUEST);
    expect(screen.getByText("Solicitud enviada a revisión. Te avisamos cuando haya una decisión.")).toBeInTheDocument();
    expect(nextStepRows()[3]).toHaveTextContent("En proceso");

    fireEvent.click(screen.getByRole("button", { name: /Ir a Mi campaña/ }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("blocks the send and shows a sanitized message when persistence fails", async () => {
    const wallet = new FakeWallet();
    wallet.seedAccount("GBXK1234567890ABCD7Q2M");
    const connection = new FakeWalletConnection();
    connection.failNextSubmit("unavailable");
    const gw = gateway();
    renderReview({ wallet, gateway: gw, connection });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });

    expect(screen.getByText(
      "No pudimos guardar tu wallet. Revisá tu conexión y probá de nuevo."
    )).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });

    // No stored key: the wallet row stays obligatory and nothing is submitted.
    expect(nextStepRows()[2]).toHaveTextContent("Obligatorio");
    expect(gw.submit).not.toHaveBeenCalled();
  });

  it("surfaces the honest unavailable state when Freighter is not installed", async () => {
    const wallet = new FakeWallet();
    wallet.failNextConnect("unavailable");
    renderReview({ wallet });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });

    expect(screen.getByText(
      "No encontramos Freighter en este navegador. Instalá la extensión y creá una wallet para continuar."
    )).toBeInTheDocument();
  });

  it("asks for Testnet when Freighter is on another network", async () => {
    const wallet = new FakeWallet();
    wallet.failNextConnect("network_mismatch");
    renderReview({ wallet });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });

    expect(screen.getByText("Freighter está en otra red. Cambiá a Stellar Testnet para continuar.")).toBeInTheDocument();
  });
});

describe("ReviewStep send", () => {
  it("reports a sanitized failure and allows a retry", async () => {
    const wallet = new FakeWallet();
    wallet.seedAccount("GBXK1234567890ABCD7Q2M");
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ applicationId: APPLICATION_ID, request: REQUEST });
    renderReview({ wallet, gateway: gateway({ submit }) });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo enviar la solicitud.");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });
    expect(screen.getByText("Solicitud enviada a revisión. Te avisamos cuando haya una decisión.")).toBeInTheDocument();
  });

  it("maps the server's 409 wallet_required rejection to an honest wallet message", async () => {
    const wallet = new FakeWallet();
    wallet.seedAccount("GBXK1234567890ABCD7Q2M");
    const submit = vi
      .fn()
      .mockRejectedValue(new HttpClientError("http", 409, undefined, "wallet_required"));
    renderReview({ wallet, gateway: gateway({ submit }) });

    await connectAndSend();

    expect(screen.getByRole("alert")).toHaveTextContent(/wallet/i);
    expect(screen.getByRole("alert")).toHaveTextContent("Volvé a conectar Freighter");
    expect(screen.queryByText(/No se pudo enviar la solicitud/)).not.toBeInTheDocument();
    expect(screen.queryByText("Solicitud enviada a revisión. Te avisamos cuando haya una decisión.")).not.toBeInTheDocument();
  });

  it("says the service is unavailable when no gateway is configured", async () => {
    const wallet = new FakeWallet();
    wallet.seedAccount("GBXK1234567890ABCD7Q2M");
    renderReview({ wallet, gateway: null });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El servicio de solicitudes no está disponible en esta demostración. No se envió nada."
    );
  });
});

function connectedWallet(): FakeWallet {
  const wallet = new FakeWallet();
  wallet.seedAccount("GBXK1234567890ABCD7Q2M");
  return wallet;
}

async function connectAndSend(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
  });
}

describe("ReviewStep company persistence", () => {
  it("creates the company once and then submits the request", async () => {
    const business = new FakeBusiness();
    const gw = gateway();
    renderReview({ wallet: connectedWallet(), business, gateway: gw });

    await connectAndSend();

    expect(business.getCalls).toBe(1);
    expect(business.creates).toEqual([DRAFT]);
    expect(gw.submit).toHaveBeenCalledWith(REQUEST);
    expect(screen.getByText("Solicitud enviada a revisión. Te avisamos cuando haya una decisión.")).toBeInTheDocument();
  });

  it("reuses an existing company without creating another", async () => {
    const business = new FakeBusiness(fakeBusinessRecord(DRAFT));
    const gw = gateway();
    renderReview({ wallet: connectedWallet(), business, gateway: gw });

    await connectAndSend();

    expect(business.getCalls).toBe(1);
    expect(business.creates).toHaveLength(0);
    expect(gw.submit).toHaveBeenCalledWith(REQUEST);
  });

  it("blocks the submit with a sanitized message when the company cannot be saved", async () => {
    const business = new FakeBusiness();
    business.failNext("create", "unavailable");
    const gw = gateway();
    renderReview({ wallet: connectedWallet(), business, gateway: gw });

    await connectAndSend();

    expect(business.creates).toHaveLength(1);
    expect(gw.submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos guardar los datos de tu empresa. No se envió la solicitud. Probá de nuevo."
    );
    expect(screen.queryByText("Solicitud enviada a revisión. Te avisamos cuando haya una decisión.")).not.toBeInTheDocument();
  });

  it("does not create a company when reading it fails for another reason", async () => {
    const business = new FakeBusiness();
    business.failNext("get", "unavailable");
    const gw = gateway();
    renderReview({ wallet: connectedWallet(), business, gateway: gw });

    await connectAndSend();

    expect(business.getCalls).toBe(1);
    expect(business.creates).toHaveLength(0);
    expect(gw.submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos guardar los datos de tu empresa.");
  });

  it("tells an invalid session apart from a generic company-save failure", async () => {
    const business = new FakeBusiness();
    business.failNext("create", "unauthorized");
    const gw = gateway();
    renderReview({ wallet: connectedWallet(), business, gateway: gw });

    await connectAndSend();

    expect(gw.submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Tu sesión no es válida o venció. Volvé a iniciar sesión.");
  });

  it("never sends an owner from the web", async () => {
    const business = new FakeBusiness();
    renderReview({ wallet: connectedWallet(), business, gateway: gateway() });

    await connectAndSend();

    const sentDraft = business.creates[0]!;
    expect(Object.keys(sentDraft).sort()).toEqual(
      ["city", "cuit", "description", "goalArs", "name", "revenueShare", "sector"].sort()
    );
    expect(JSON.stringify(sentDraft)).not.toContain("owner");
  });

  it("does not touch the company when no wallet is connected", () => {
    const business = new FakeBusiness();
    const gw = gateway();
    renderReview({ business, gateway: gw });

    fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));

    expect(business.getCalls).toBe(0);
    expect(business.creates).toHaveLength(0);
    expect(gw.submit).not.toHaveBeenCalled();
  });

  it("does not touch the company when no gateway is configured", async () => {
    const business = new FakeBusiness();
    renderReview({ wallet: connectedWallet(), business, gateway: null });

    await connectAndSend();

    expect(business.getCalls).toBe(0);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El servicio de solicitudes no está disponible en esta demostración. No se envió nada."
    );
  });
});
