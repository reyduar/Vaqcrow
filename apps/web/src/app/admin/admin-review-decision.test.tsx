import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { HumanDecisionRecord } from "@vaqcrow/contracts";
import type {
  AdminDocumentFileResult,
  AdminReviewContext,
  AdminReviewPort,
  AdminReviewResult,
  RecordDecisionRequest,
  RecordDecisionResult,
  SetDocumentVerdictResult
} from "@/application/ports/admin-review-port";
import { ApplicationReview } from "@/presentation/components/admin/application-review";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/pymes"
}));

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const CONTEXT: AdminReviewContext = {
  applicationId: APPLICATION_ID,
  state: "human_review",
  smeRequest: {
    smeReference: "sme-001",
    declaredTotalArs: 1_500_000,
    periodStart: "2026-01",
    periodEnd: "2026-06",
    simuladoLabel: "SIMULADO"
  },
  company: {
    name: "Panadería Horizonte SRL",
    cuit: "30-71234567-8",
    sector: "Alimentos",
    city: "Rosario",
    description: "Panadería de barrio.",
    goalArs: 12_000_000,
    revenueShare: 5,
    deadline: null
  },
  documents: [],
  documentVerdicts: [],
  assessment: null,
  latestHumanDecision: null
};

function recordFor(request: RecordDecisionRequest): HumanDecisionRecord {
  return {
    ...request,
    applicationId: APPLICATION_ID,
    actor: "Admin Vaqcrow",
    decidedAt: "2026-10-07T15:30:00.000Z",
    correlationId: "66666666-6666-4666-8666-666666666666"
  } as unknown as HumanDecisionRecord;
}

class FakePort implements AdminReviewPort {
  context: AdminReviewContext = CONTEXT;
  contextCalls = 0;
  readonly decisionCalls: RecordDecisionRequest[] = [];
  decisionResult: (request: RecordDecisionRequest) => RecordDecisionResult | Promise<RecordDecisionResult> = (request) => ({
    ok: true,
    applied: true,
    decision: recordFor(request)
  });

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

  async recordDecision(applicationId: string, request: RecordDecisionRequest): Promise<RecordDecisionResult> {
    expect(applicationId).toBe(APPLICATION_ID);
    this.decisionCalls.push(request);
    return this.decisionResult(request);
  }
  async getDeployment() {
    return { ok: false, code: "not_found" } as const;
  }

  async deploy() {
    return { ok: false, code: "unavailable" } as const;
  }
}

function swr({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

async function renderReview(port: FakePort, displayName: string | null = "M. Pereyra") {
  const session = new FakeAuthSession();
  if (displayName !== null) {
    session.seedAccount({ email: "op@vaqcrow.test", password: "secret-123", role: "ADMIN", displayName });
    await session.signIn({ email: "op@vaqcrow.test", password: "secret-123" });
  }
  return render(
    <SessionStoreProvider port={session}>
      <ApplicationReview applicationId={APPLICATION_ID} port={port} />
    </SessionStoreProvider>,
    { wrapper: swr }
  );
}

async function decisionSection() {
  return (await screen.findByRole("heading", { level: 2, name: "3 · Decisión humana" })).closest("section") as HTMLElement;
}

async function fillAndOpenDialog(section: HTMLElement, outcome: string, reason: string) {
  fireEvent.click(within(section).getByRole("radio", { name: outcome }));
  fireEvent.change(within(section).getByRole("textbox", { name: "Razón" }), { target: { value: reason } });
  fireEvent.click(within(section).getByRole("button", { name: "Registrar decisión" }));
  return screen.findByRole("alertdialog", { name: "Registrar decisión" });
}

describe("admin review · 3 · Decisión humana", () => {
  it("renders the template's form with the read-only limit prefilled from the PyME's goal (D7)", async () => {
    await renderReview(new FakePort());
    const section = await decisionSection();

    expect(
      within(section).getByText(
        "Esta decisión la registra una persona. La recomendación de IA no aprueba ni transfiere fondos."
      )
    ).toBeInTheDocument();
    const group = within(section).getByRole("radiogroup", { name: "Decisión" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toBe(within(group).getByRole("radio", { name: "Aprobar con límite" }));
    expect(radios[1]).toBe(within(group).getByRole("radio", { name: "Requiere cambios" }));
    expect(radios[2]).toBe(within(group).getByRole("radio", { name: "Rechazar" }));
    for (const radio of within(group).getAllByRole("radio")) expect(radio).not.toBeChecked();

    const reason = within(section).getByRole("textbox", { name: "Razón" });
    expect(reason).toHaveAttribute("placeholder", "Obligatoria. Queda visible en el detalle de la campaña.");
    expect(reason).toHaveAttribute("maxLength", "1000");

    const limit = within(section).getByRole("textbox", { name: "Límite aprobado (ARS)" });
    expect(limit).toHaveValue("12.000.000");
    expect(limit).toHaveAttribute("readOnly");
    fireEvent.change(limit, { target: { value: "99" } });
    expect(limit).toHaveValue("12.000.000");
  });

  it("shows inline errors and opens no dialog when the form is incomplete", async () => {
    const port = new FakePort();
    await renderReview(port);
    const section = await decisionSection();

    fireEvent.change(within(section).getByRole("textbox", { name: "Razón" }), { target: { value: "  corta  " } });
    fireEvent.click(within(section).getByRole("button", { name: "Registrar decisión" }));

    const reason = within(section).getByRole("textbox", { name: "Razón" });
    expect(reason).toHaveAttribute("aria-invalid", "true");
    const describedBy = reason.getAttribute("aria-describedby") ?? "";
    expect(describedBy).not.toBe("");
    expect(document.getElementById(describedBy.split(" ")[0]!)).toHaveTextContent(
      "La razón debe tener al menos 10 caracteres."
    );
    expect(within(section).getByText("Elegí una decisión.")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(port.decisionCalls).toHaveLength(0);
  });

  it("cancels the confirmation without recording anything", async () => {
    const port = new FakePort();
    await renderReview(port);
    const section = await decisionSection();

    const dialog = await fillAndOpenDialog(section, "Rechazar", "Documentación inconsistente.");
    expect(dialog).toHaveTextContent(
      "Rechazada. Queda atribuida a M. Pereyra y visible para la PyME y los aportantes."
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(port.decisionCalls).toHaveLength(0);
  });

  it("records an approval with the goal as approvedLimitArs, shows the server's line and reloads", async () => {
    const port = new FakePort();
    await renderReview(port);
    const section = await decisionSection();
    const before = port.contextCalls;

    const dialog = await fillAndOpenDialog(section, "Aprobar con límite", "  Ventas consistentes con lo declarado.  ");
    expect(dialog).toHaveTextContent(
      "Aprobada con límite ARS 12.000.000. Queda atribuida a M. Pereyra y visible para la PyME y los aportantes."
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    const status = await within(section).findByRole("status");
    expect(status).toHaveTextContent("Registrada por Admin Vaqcrow · 07/10/2026 12:30 · Aprobada");
    expect(port.decisionCalls).toHaveLength(1);
    expect(port.decisionCalls[0]).toStrictEqual({
      decisionId: port.decisionCalls[0]!.decisionId,
      outcome: "approved",
      reason: "Ventas consistentes con lo declarado.",
      approvedLimitArs: 12_000_000
    });
    expect(port.decisionCalls[0]!.decisionId).toMatch(UUID_V4);
    await waitFor(() => expect(port.contextCalls).toBeGreaterThan(before));
  });

  it("sends approvedLimitArs null for a non-approval", async () => {
    const port = new FakePort();
    await renderReview(port);
    const section = await decisionSection();

    const dialog = await fillAndOpenDialog(section, "Requiere cambios", "Falta la declaración de abril.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await within(section).findByRole("status")).toHaveTextContent("Requiere cambios");
    expect(port.decisionCalls[0]).toMatchObject({ outcome: "changes_requested", approvedLimitArs: null });
  });

  it("makes approving impossible, with a visible reason, when there is no company", async () => {
    const port = new FakePort();
    port.context = { ...CONTEXT, company: null };
    await renderReview(port);
    const section = await decisionSection();

    const approve = within(section).getByRole("radio", { name: "Aprobar con límite" });
    expect(approve).toBeDisabled();
    expect(
      within(section).getByText("No se puede aprobar: la PyME no tiene un objetivo de financiamiento registrado.")
    ).toBeInTheDocument();
    expect(within(section).getByRole("textbox", { name: "Límite aprobado (ARS)" })).toHaveValue("Sin dato");
    expect(within(section).getByRole("radio", { name: "Rechazar" })).toBeEnabled();
  });

  it("is read-only when a decision is already recorded", async () => {
    const port = new FakePort();
    port.context = {
      ...CONTEXT,
      state: "approved",
      latestHumanDecision: recordFor({
        decisionId: "44444444-4444-4444-8444-444444444444",
        outcome: "approved",
        reason: "Ventas consistentes con lo declarado.",
        approvedLimitArs: 12_000_000
      })
    };
    await renderReview(port);
    const section = await decisionSection();

    expect(within(section).getByRole("status")).toHaveTextContent(
      "Registrada por Admin Vaqcrow · 07/10/2026 12:30 · Aprobada"
    );
    expect(within(section).getByText("Ventas consistentes con lo declarado.")).toBeInTheDocument();
    expect(within(section).getByText("12.000.000")).toBeInTheDocument();
    expect(within(section).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(within(section).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Registrar decisión" })).not.toBeInTheDocument();
  });

  it("keeps the form closed outside human review", async () => {
    const port = new FakePort();
    port.context = { ...CONTEXT, state: "awaiting_assessment" };
    await renderReview(port);
    const section = await decisionSection();

    expect(
      within(section).getByText("La decisión se habilita cuando la solicitud está en revisión humana.")
    ).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Registrar decisión" })).toBeDisabled();
    for (const radio of within(section).getAllByRole("radio")) expect(radio).toBeDisabled();
  });

  it("is honest about a 409 state_conflict and reloads", async () => {
    const port = new FakePort();
    port.decisionResult = () => ({ ok: false, code: "state_conflict", actualState: "rejected" });
    await renderReview(port);
    const section = await decisionSection();
    const before = port.contextCalls;

    const dialog = await fillAndOpenDialog(section, "Rechazar", "Documentación inconsistente.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await within(section).findByRole("alert")).toHaveTextContent(
      "Esta solicitud ya tiene una decisión registrada. No se registró tu decisión."
    );
    expect(within(section).queryByRole("status")).not.toBeInTheDocument();
    await waitFor(() => expect(port.contextCalls).toBeGreaterThan(before));
  });

  it("keeps the form after a network failure and reuses the decision id on retry", async () => {
    const port = new FakePort();
    let fail = true;
    port.decisionResult = (request) => (fail ? { ok: false, code: "network" } : { ok: true, applied: false, decision: recordFor(request) });
    await renderReview(port);
    const section = await decisionSection();

    const dialog = await fillAndOpenDialog(section, "Rechazar", "Documentación inconsistente.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await within(section).findByRole("alert")).toHaveTextContent(
      "No pudimos confirmar que la decisión se haya registrado. Reintentar es seguro: si ya se guardó, no se duplica."
    );
    expect(within(section).queryByRole("status")).not.toBeInTheDocument();
    expect(within(section).getByRole("textbox", { name: "Razón" })).toHaveValue("Documentación inconsistente.");
    expect(within(section).getByRole("radio", { name: "Rechazar" })).toBeChecked();

    fail = false;
    fireEvent.click(within(section).getByRole("button", { name: "Registrar decisión" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirmar" }));

    expect(await within(section).findByRole("status")).toHaveTextContent("Rechazada");
    expect(port.decisionCalls).toHaveLength(2);
    expect(port.decisionCalls[1]!.decisionId).toBe(port.decisionCalls[0]!.decisionId);
  });

  it("uses a fresh decision id after an idempotency conflict or an edited reason", async () => {
    const port = new FakePort();
    port.decisionResult = () => ({ ok: false, code: "idempotency_conflict" });
    await renderReview(port);
    const section = await decisionSection();

    const dialog = await fillAndOpenDialog(section, "Rechazar", "Documentación inconsistente.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(await within(section).findByRole("alert")).toHaveTextContent(
      "No pudimos registrar la decisión. No se registró nada; podés reintentar."
    );

    port.decisionResult = () => ({ ok: false, code: "unavailable" });
    fireEvent.click(within(section).getByRole("button", { name: "Registrar decisión" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(port.decisionCalls).toHaveLength(2));
    expect(port.decisionCalls[1]!.decisionId).not.toBe(port.decisionCalls[0]!.decisionId);

    const edited = await fillAndOpenDialog(section, "Rechazar", "Documentación inconsistente y vencida.");
    fireEvent.click(within(edited).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(port.decisionCalls).toHaveLength(3));
    expect(port.decisionCalls[2]!.decisionId).not.toBe(port.decisionCalls[1]!.decisionId);
  });

  it("attributes the dialog truthfully when the session has no display name", async () => {
    await renderReview(new FakePort(), null);
    const section = await decisionSection();

    const dialog = await fillAndOpenDialog(section, "Rechazar", "Documentación inconsistente.");
    expect(dialog).toHaveTextContent(
      "Rechazada. Queda atribuida a tu cuenta de administrador y visible para la PyME y los aportantes."
    );
  });
});
