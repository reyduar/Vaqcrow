import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import type { SmeRequest } from "@vaqcrow/contracts";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { FakeKyc } from "@/test/fake-kyc";
import { FakeWalletBalance, FakeWalletConnection } from "@/test/fake-wallet";
import { FakeWallet } from "@/test/fake-wallet";
import { FakeBusiness } from "@/test/fake-business";
import { FakeCompleteness } from "@/test/fake-completeness";
import { FakeUpload } from "@/test/fake-upload";
import { CompanyWorkspace } from "@/presentation/components/pyme-onboarding/company-workspace";

vi.mock("@/infrastructure/wallet/freighter-wallet", async () => {
  const { FakeWallet } = await import("@/test/fake-wallet");
  return { FreighterWallet: class extends FakeWallet { constructor() { super({ publicKey: "GBXK1234567890ABCD7Q2M" }); } } };
});
vi.mock("@/infrastructure/ai-evaluation/simulated-ai-evaluation-adapter", async () => {
  const { FakeAiEvaluation } = await import("@/test/fake-ai-evaluation");
  return { SimulatedAiEvaluationAdapter: FakeAiEvaluation };
});
vi.mock("@/infrastructure/business/create-business-port", async () => {
  const { FakeBusiness } = await import("@/test/fake-business");
  return { createBrowserBusinessPort: () => new FakeBusiness() };
});
vi.mock("@/infrastructure/completeness/create-completeness-port", async () => {
  const { FakeCompleteness } = await import("@/test/fake-completeness");
  return { createBrowserCompletenessPort: () => new FakeCompleteness() };
});
vi.mock("@/infrastructure/wallet/create-wallet-connection-port", async () => {
  const { FakeWalletConnection } = await import("@/test/fake-wallet");
  return { createBrowserWalletConnectionPort: () => new FakeWalletConnection() };
});

afterEach(() => vi.clearAllMocks());

const CAPTURED = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const PROP = "11111111-2222-4333-8444-555555555555";
const SAVED: SmeRequest = { smeReference: "sme:T", declaredTotalArs: 100, periodStart: "2026-01", periodEnd: "2026-02", simuladoLabel: "SIMULADO" };

function pdf(name: string) { return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: "application/pdf" }); }

describe("PROBE in-session submit still works (S6 capture)", () => {
  it("after a fresh-session submit the captured id drives the state (not the prop)", async () => {
    const kyc = new FakeKyc();
    const load = vi.fn(async (id: string) => ({ request: SAVED, salesPeriods: [], state: id === PROP ? ("draft" as const) : ("awaiting_assessment" as const) }));
    const gw: SmeRequestGateway = {
      submit: vi.fn().mockResolvedValue({ applicationId: CAPTURED, request: SAVED }),
      load: load as unknown as SmeRequestGateway["load"],
      loadMine: vi.fn().mockResolvedValue({ ok: true, application: null })
    };

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CompanyWorkspace
          kyc={kyc}
          upload={new FakeUpload()}
          connection={new FakeWalletConnection()}
          balance={new FakeWalletBalance()}
          applicationId={PROP}
          smeRequestGateway={gw}
        />
      </SWRConfig>
    );

    await waitFor(() => expect(gw.loadMine).toHaveBeenCalledTimes(1));
    // the prop id resolves to `draft` so the wizard is reachable in this session
    expect(await screen.findByRole("button", { name: "Registrar mi PyME" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar mi PyME" }));

    // Step 1 KYC
    const release = kyc.holdNextVerify();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar verificación simulada" }));
    await act(async () => { release(); });
    await screen.findByText("KYC aprobado · SIMULADO");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));

    // Step 2
    fireEvent.click(screen.getByRole("button", { name: "Completar con datos de ejemplo" }));
    for (const t of ["Declaraciones de ventas", "Constancia de CUIT", "Estatuto"]) {
      await act(async () => { fireEvent.change(screen.getByLabelText(t), { target: { files: [pdf(`${t}.pdf`)] } }); });
    }
    fireEvent.click(screen.getByRole("button", { name: "Enviar a evaluación AI" }));
    fireEvent.click(await screen.findByRole("button", { name: /Continuar/ }));

    // Step 4 send
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ })); });
    await waitFor(() => expect(gw.submit).toHaveBeenCalled());

    // back to /company: the captured id must now drive the banner
    fireEvent.click(screen.getByRole("button", { name: "Volver a la pantalla anterior" }));
    expect(await screen.findByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("En revisión");
    await waitFor(() => expect(load).toHaveBeenCalledWith(CAPTURED));
    expect(screen.queryByRole("button", { name: "Registrar mi PyME" })).not.toBeInTheDocument();
  }, 20000);
});
