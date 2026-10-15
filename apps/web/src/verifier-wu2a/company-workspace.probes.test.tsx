import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";
import type { ApplicationReviewState, SmeRequest } from "@vaqcrow/contracts";
import type { MyCampaignsPort } from "@/application/ports/my-campaigns-port";
import type { SmeRequestGateway, MyApplicationOutcome } from "@/application/ports/sme-request-gateway";
import { FakeKyc } from "@/test/fake-kyc";
import { FakeWalletBalance, FakeWalletConnection } from "@/test/fake-wallet";
import { CompanyWorkspace, captureApplicationIdOnSubmit } from "@/presentation/components/pyme-onboarding/company-workspace";

afterEach(cleanup);

const MINE_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const PROP_ID = "11111111-2222-4333-8444-555555555555";

const SME_REQUEST: SmeRequest = {
  smeReference: "sme:T",
  declaredTotalArs: 100,
  periodStart: "2026-01",
  periodEnd: "2026-02",
  simuladoLabel: "SIMULADO"
};
const emptyCampaigns: MyCampaignsPort = { get: async () => ({ ok: true, myCampaigns: { campaigns: [] } }) };

function gw(mine: SmeRequestGateway["loadMine"], load?: SmeRequestGateway["load"]): SmeRequestGateway {
  return { submit: vi.fn(), load: load ?? vi.fn(), loadMine: mine };
}

function renderCompany(g: SmeRequestGateway, applicationId?: string) {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CompanyWorkspace
        kyc={new FakeKyc()}
        connection={new FakeWalletConnection()}
        balance={new FakeWalletBalance()}
        myCampaigns={emptyCampaigns}
        smeRequestGateway={g}
        {...(applicationId !== undefined ? { applicationId } : {})}
      />
    </SWRConfig>
  );
}

const registerBtn = () => screen.queryByRole("button", { name: "Registrar mi PyME" });
const banner = () => screen.queryByRole("region", { name: "Estado de tu solicitud" });

describe("PROBE CompanyWorkspace #530 (S1/S2/S3/S6)", () => {
  it("S6 fresh session: resolving the owned application hides the button and shows its real state", async () => {
    const load = vi.fn().mockResolvedValue({ request: SME_REQUEST, salesPeriods: [], state: "human_review" });
    const g = gw(vi.fn().mockResolvedValue({ ok: true, application: { applicationId: MINE_ID, state: "human_review" } }), load);
    renderCompany(g);
    expect(await screen.findByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("En revisión");
    expect(registerBtn()).not.toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledWith(MINE_ID));
  });

  it.each(["awaiting_assessment", "human_review"] as const)("S1 %s hides the button", async (state) => {
    renderCompany(gw(vi.fn().mockResolvedValue({ ok: true, application: { applicationId: MINE_ID, state } })));
    await waitFor(() => expect(banner()).toBeInTheDocument());
    expect(registerBtn()).not.toBeInTheDocument();
  });

  it("S2 approved hides the button", async () => {
    renderCompany(gw(vi.fn().mockResolvedValue({ ok: true, application: { applicationId: MINE_ID, state: "approved" } })));
    expect(await screen.findByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("Aprobada");
    expect(registerBtn()).not.toBeInTheDocument();
  });

  it.each(["changes_requested", "rejected"] as const)("S3 %s hides the button", async (state) => {
    renderCompany(gw(vi.fn().mockResolvedValue({ ok: true, application: { applicationId: MINE_ID, state } })));
    await waitFor(() => expect(banner()).toBeInTheDocument());
    expect(registerBtn()).not.toBeInTheDocument();
  });

  it("Sin enviar (owned absence): button shown and the wizard opens", async () => {
    const g = gw(vi.fn().mockResolvedValue({ ok: true, application: null }));
    renderCompany(g);
    await waitFor(() => expect(g.loadMine).toHaveBeenCalledTimes(1));
    fireEvent.click(registerBtn()!);
    expect(screen.getByRole("heading", { level: 1, name: "Verificación de identidad" })).toBeInTheDocument();
  });

  it("Sin enviar (draft): button still offered, banner reads Sin enviar", async () => {
    renderCompany(gw(vi.fn().mockResolvedValue({ ok: true, application: { applicationId: MINE_ID, state: "draft" } })));
    expect(await screen.findByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("Sin enviar");
    expect(registerBtn()).toBeInTheDocument();
  });

  it("#480 unknown read (still pending) never hides the button, and shows no banner", async () => {
    renderCompany(gw(vi.fn().mockReturnValue(new Promise<MyApplicationOutcome>(() => {}))));
    await new Promise((r) => setTimeout(r, 40));
    expect(registerBtn()).toBeInTheDocument();
    expect(banner()).not.toBeInTheDocument();
  });

  it("#480 failed read (unavailable) never hides the button", async () => {
    const g = gw(vi.fn().mockResolvedValue({ ok: false, code: "unavailable" }));
    renderCompany(g);
    await waitFor(() => expect(g.loadMine).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(registerBtn()).toBeInTheDocument();
    expect(banner()).not.toBeInTheDocument();
  });

  it("order: a resolved `mine` beats the `applicationId` prop (mine state wins the banner)", async () => {
    // Distinct states per id: only `mine.state` ("approved") can win; if the
    // prop's read decided, the banner would read "Requiere cambios"/"Rechazada".
    const load = vi.fn(async (id: string) => ({
      request: SME_REQUEST,
      salesPeriods: [],
      state: id === PROP_ID ? ("rejected" as const) : ("changes_requested" as const)
    }));
    const g = gw(vi.fn().mockResolvedValue({ ok: true, application: { applicationId: MINE_ID, state: "approved" } }), load as unknown as SmeRequestGateway["load"]);
    renderCompany(g, PROP_ID);
    expect(await screen.findByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("Aprobada");
    await waitFor(() => expect(load).toHaveBeenCalledWith(MINE_ID));
    expect(registerBtn()).not.toBeInTheDocument();
  });

  it("order: with no owned application the `applicationId` prop still drives the banner", async () => {
    const load = vi.fn().mockResolvedValue({ request: SME_REQUEST, salesPeriods: [], state: "human_review" });
    const g = gw(vi.fn().mockResolvedValue({ ok: true, application: null }), load);
    renderCompany(g, PROP_ID);
    expect(await screen.findByRole("region", { name: "Estado de tu solicitud" })).toHaveTextContent("En revisión");
    await waitFor(() => expect(load).toHaveBeenCalledWith(PROP_ID));
    expect(registerBtn()).not.toBeInTheDocument();
  });

  it("wrapper: captureApplicationIdOnSubmit captures the id and forwards load + loadMine", async () => {
    const onCaptured = vi.fn();
    const load = vi.fn().mockResolvedValue({ request: SME_REQUEST, salesPeriods: [], state: "approved" });
    const loadMine = vi.fn().mockResolvedValue({ ok: true, application: null });
    const inner: SmeRequestGateway = {
      submit: vi.fn().mockResolvedValue({ applicationId: MINE_ID, request: SME_REQUEST }),
      load,
      loadMine
    };
    const wrapped = captureApplicationIdOnSubmit(inner, onCaptured)!;
    await wrapped.submit(SME_REQUEST);
    expect(onCaptured).toHaveBeenCalledWith(MINE_ID);
    await wrapped.load(PROP_ID);
    expect(load).toHaveBeenCalledWith(PROP_ID);
    await wrapped.loadMine();
    expect(loadMine).toHaveBeenCalledTimes(1);
    expect(captureApplicationIdOnSubmit(null, vi.fn())).toBeNull();
  });
});
