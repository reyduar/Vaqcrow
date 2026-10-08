import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type {
  AdminDeployment,
  AdminDocumentFileResult,
  AdminReviewContext,
  AdminReviewPort,
  AdminReviewResult,
  DeployResult,
  GetDeploymentResult,
  RecordDecisionResult,
  SetDocumentVerdictResult
} from "@/application/ports/admin-review-port";
import { deploymentErrorText } from "@/application/admin/deployment";
import { ApplicationReview } from "@/presentation/components/admin/application-review";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/pymes"
}));

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_ID = "77777777-7777-4777-8777-777777777777";
const TITLE = "Despliegue de la bóveda";

const CONTEXT: AdminReviewContext = {
  applicationId: APPLICATION_ID,
  state: "approved",
  smeRequest: {
    smeReference: "sme-001",
    declaredTotalArs: 1_500_000,
    periodStart: "2026-01",
    periodEnd: "2026-06",
    simuladoLabel: "SIMULADO"
  },
  company: null,
  documents: [],
  documentVerdicts: [],
  assessment: null,
  latestHumanDecision: null
};

const DEPLOYMENT: AdminDeployment = {
  applicationId: APPLICATION_ID,
  state: "pending",
  attempts: 0,
  campaignId: null,
  lastError: null,
  retryable: false,
  createdAt: "2026-10-07T15:30:00.000Z",
  updatedAt: "2026-10-07T15:31:00.000Z"
};

class FakePort implements AdminReviewPort {
  context: AdminReviewContext = CONTEXT;
  contextCalls = 0;
  deployCalls = 0;
  read: () => GetDeploymentResult = () => ({ ok: true, deployment: DEPLOYMENT });
  deployResult: () => DeployResult | Promise<DeployResult> = () => ({ ok: false, code: "unavailable" });

  async getContext(): Promise<AdminReviewResult> {
    this.contextCalls += 1;
    return { ok: true, context: this.context };
  }

  async setDocumentVerdict(): Promise<SetDocumentVerdictResult> {
    return { ok: false, code: "unavailable" };
  }

  async downloadDocument(): Promise<AdminDocumentFileResult> {
    return { ok: false, code: "unavailable" };
  }

  async recordDecision(): Promise<RecordDecisionResult> {
    return { ok: false, code: "unavailable" };
  }

  async getDeployment(applicationId: string): Promise<GetDeploymentResult> {
    expect(applicationId).toBe(APPLICATION_ID);
    return this.read();
  }

  async deploy(applicationId: string): Promise<DeployResult> {
    expect(applicationId).toBe(APPLICATION_ID);
    this.deployCalls += 1;
    return this.deployResult();
  }
}

function swr({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function renderReview(port: FakePort) {
  return render(
    <SessionStoreProvider port={new FakeAuthSession()}>
      <ApplicationReview applicationId={APPLICATION_ID} port={port} deploymentPollIntervalMs={10} />
    </SessionStoreProvider>,
    { wrapper: swr }
  );
}

async function deploymentSection() {
  return (await screen.findByRole("heading", { level: 2, name: TITLE })).closest("section") as HTMLElement;
}

function withState(state: AdminDeployment["state"], patch: Partial<AdminDeployment> = {}) {
  const port = new FakePort();
  // The API reports a failed attempt as retryable; a patch may override it.
  port.read = () => ({ ok: true, deployment: { ...DEPLOYMENT, state, retryable: state === "failed", ...patch } });
  return port;
}

describe("admin review · deployment panel (D3)", () => {
  it("renders nothing while the review is not approved and no deployment exists", async () => {
    const port = new FakePort();
    port.context = { ...CONTEXT, state: "human_review" };
    port.read = () => ({ ok: false, code: "not_found" });
    renderReview(port);

    await screen.findByRole("heading", { level: 2, name: "3 · Decisión humana" });
    await waitFor(() => expect(screen.queryByRole("heading", { level: 2, name: TITLE })).not.toBeInTheDocument());
  });

  it.each([
    ["pending", "Pendiente de confirmación"],
    ["deploying", "Desplegando bóveda"]
  ] as const)("shows %s as not confirmed, without Reintentar", async (state, label) => {
    renderReview(withState(state));
    const section = await deploymentSection();

    expect(await within(section).findByText(label)).toBeInTheDocument();
    expect(within(section).getByText("TESTNET")).toBeInTheDocument();
    expect(within(section).queryByText("Bóveda confirmada / PyME publicada")).not.toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("shows the ledger-confirmed outcome with its campaign id under Ver detalle", async () => {
    renderReview(withState("confirmed", { attempts: 1, campaignId: CAMPAIGN_ID }));
    const section = await deploymentSection();

    expect(await within(section).findByText("Bóveda confirmada / PyME publicada")).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();

    const toggle = within(section).getByRole("button", { name: "Ver detalle" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(section).getByText("ID de campaña")).toBeInTheDocument();
    expect(within(section).getByText(CAMPAIGN_ID)).toBeInTheDocument();
    expect(within(section).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows a failure with its honest reason, Reintentar and read-only details", async () => {
    renderReview(withState("failed", { attempts: 2, lastError: "wallet_required" }));
    const section = await deploymentSection();

    expect(await within(section).findByText("Despliegue fallido")).toBeInTheDocument();
    expect(within(section).getAllByText(new RegExp(deploymentErrorText("wallet_required").slice(0, 30))).length).toBeGreaterThan(0);
    expect(within(section).getByRole("button", { name: "Reintentar" })).toBeEnabled();

    fireEvent.click(within(section).getByRole("button", { name: "Ver detalle" }));
    expect(within(section).getByText("Intentos")).toBeInTheDocument();
    expect(within(section).getByText("2")).toBeInTheDocument();
    expect(within(section).getByText("Último error")).toBeInTheDocument();
    expect(within(section).getByText("07/10/2026 12:30")).toBeInTheDocument();
  });

  it("Reintentar posts once, is disabled in flight and revalidates the panel and the review", async () => {
    const port = withState("failed", { attempts: 1, lastError: "unavailable" });
    let resolveDeploy: (value: DeployResult) => void = () => undefined;
    port.deployResult = () => new Promise<DeployResult>((resolve) => (resolveDeploy = resolve));
    renderReview(port);
    const section = await deploymentSection();
    const before = port.contextCalls;

    fireEvent.click(await within(section).findByRole("button", { name: "Reintentar" }));
    const busy = await within(section).findByRole("button", { name: "Reintentando…" });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(port.deployCalls).toBe(1);

    port.read = () => ({ ok: true, deployment: { ...DEPLOYMENT, state: "confirmed", attempts: 2, campaignId: CAMPAIGN_ID } });
    resolveDeploy({ ok: true, deployment: { ...DEPLOYMENT, state: "confirmed", attempts: 2, campaignId: CAMPAIGN_ID } });

    expect(await within(section).findByText("Bóveda confirmada / PyME publicada")).toBeInTheDocument();
    await waitFor(() => expect(port.contextCalls).toBeGreaterThan(before));
  });

  it("keeps an honest alert when the retry is refused", async () => {
    const port = withState("failed", { attempts: 1, lastError: "unavailable" });
    port.deployResult = () => ({ ok: false, code: "rate_unavailable" });
    renderReview(port);
    const section = await deploymentSection();

    fireEvent.click(await within(section).findByRole("button", { name: "Reintentar" }));
    expect(await within(section).findByRole("alert")).toHaveTextContent(/no se completó/);
    expect(within(section).queryByText("Bóveda confirmada / PyME publicada")).not.toBeInTheDocument();
  });

  it("says honestly that no deployment is recorded yet and offers Desplegar without deploying on its own", async () => {
    const port = new FakePort();
    port.read = () => ({ ok: false, code: "not_found" });
    renderReview(port);
    const section = await deploymentSection();

    expect(await within(section).findByText(/Todavía no hay un despliegue registrado/)).toBeInTheDocument();
    expect(within(section).queryByText("Pendiente de confirmación")).not.toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Desplegar" })).toBeEnabled();
    expect(within(section).getByRole("button", { name: "Actualizar" })).toBeInTheDocument();
    expect(port.deployCalls).toBe(0);
  });

  it("Desplegar posts once, is disabled in flight and shows the resulting state (U8)", async () => {
    const port = new FakePort();
    port.read = () => ({ ok: false, code: "not_found" });
    let resolveDeploy: (value: DeployResult) => void = () => undefined;
    port.deployResult = () => new Promise<DeployResult>((resolve) => (resolveDeploy = resolve));
    renderReview(port);
    const section = await deploymentSection();

    fireEvent.click(await within(section).findByRole("button", { name: "Desplegar" }));
    const busy = await within(section).findByRole("button", { name: "Desplegando…" });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(port.deployCalls).toBe(1);

    const confirmed = { ...DEPLOYMENT, state: "confirmed" as const, attempts: 1, campaignId: CAMPAIGN_ID };
    port.read = () => ({ ok: true, deployment: confirmed });
    resolveDeploy({ ok: true, deployment: confirmed });

    expect(await within(section).findByText("Bóveda confirmada / PyME publicada")).toBeInTheDocument();
  });

  it("offers Reintentar for a stale deploying attempt with honest copy (U8)", async () => {
    renderReview(withState("deploying", { attempts: 1, retryable: true }));
    const section = await deploymentSection();

    expect(await within(section).findByText("Despliegue sin finalizar")).toBeInTheDocument();
    expect(within(section).queryByText("Desplegando bóveda")).not.toBeInTheDocument();
    expect(within(section).getByText(/no terminó/)).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });

  it("does not offer Reintentar for a fresh deploying attempt", async () => {
    renderReview(withState("deploying", { attempts: 1 }));
    const section = await deploymentSection();

    expect(await within(section).findByText("Desplegando bóveda")).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("explains a deployment already in progress after Reintentar (U8)", async () => {
    const port = withState("deploying", { attempts: 1, retryable: true });
    port.deployResult = () => ({ ok: false, code: "deployment_in_progress" });
    renderReview(port);
    const section = await deploymentSection();

    fireEvent.click(await within(section).findByRole("button", { name: "Reintentar" }));
    expect(await within(section).findByRole("alert")).toHaveTextContent(/en curso/);
    expect(within(section).queryByText("Bóveda confirmada / PyME publicada")).not.toBeInTheDocument();
  });

  it("shows a read failure without claiming any state, and re-reads on Actualizar", async () => {
    const port = new FakePort();
    port.read = () => ({ ok: false, code: "unavailable" });
    renderReview(port);
    const section = await deploymentSection();

    expect(await within(section).findByRole("alert")).toHaveTextContent(/No pudimos leer el estado del despliegue/);
    port.read = () => ({ ok: true, deployment: { ...DEPLOYMENT, state: "deploying" } });
    fireEvent.click(within(section).getByRole("button", { name: "Actualizar" }));
    expect(await within(section).findByText("Desplegando bóveda")).toBeInTheDocument();
  });
});
