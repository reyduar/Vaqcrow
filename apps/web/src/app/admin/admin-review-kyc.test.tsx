import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import type { DocumentVerdictValue } from "@vaqcrow/contracts";
import type {
  AdminDocumentFileResult,
  AdminReviewContext,
  AdminReviewPort,
  AdminReviewResult,
  RecordDecisionResult,
  SetDocumentVerdictResult
} from "@/application/ports/admin-review-port";
import type { OpenDocumentWindow, PendingDocumentWindow } from "@/application/ports/document-window-port";
import { ApplicationReview } from "@/presentation/components/admin/application-review";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/pymes"
}));

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";
const CUIT_ID = "55555555-5555-4555-8555-555555555555";
const SALES_ID = "66666666-6666-4666-8666-666666666666";
const PHOTO_ID = "77777777-7777-4777-8777-777777777777";

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
  documents: [
    {
      documentId: SALES_ID,
      kind: "sales-declarations",
      objectPath: "owner/sales-declarations/a-ventas.pdf",
      name: "ventas.pdf",
      sizeBytes: 2048,
      contentType: "application/pdf",
      createdAt: "2026-09-11T12:00:00.000Z"
    },
    {
      documentId: CUIT_ID,
      kind: "cuit",
      objectPath: "owner/cuit/b-constancia.pdf",
      name: "constancia.pdf",
      sizeBytes: 2048,
      contentType: "application/pdf",
      createdAt: "2026-09-11T12:00:00.000Z"
    },
    {
      documentId: PHOTO_ID,
      kind: "photo",
      objectPath: "owner/photo/c-local.jpg",
      name: "local.jpg",
      sizeBytes: 4096,
      contentType: "image/jpeg",
      createdAt: "2026-09-11T12:00:00.000Z"
    }
  ],
  documentVerdicts: [
    { documentId: SALES_ID, verdict: "request", actor: "Admin Vaqcrow", updatedAt: "2026-10-07T12:00:00.000Z" }
  ],
  assessment: null,
  latestHumanDecision: null
};

interface VerdictCall {
  readonly applicationId: string;
  readonly documentId: string;
  readonly verdict: DocumentVerdictValue;
}

class FakePort implements AdminReviewPort {
  context: AdminReviewContext = CONTEXT;
  contextCalls = 0;
  readonly verdictCalls: VerdictCall[] = [];
  readonly downloads: string[] = [];
  verdictResult: () => SetDocumentVerdictResult | Promise<SetDocumentVerdictResult> = () => ({
    ok: false,
    code: "unavailable"
  });
  downloadResult: () => AdminDocumentFileResult = () => ({ ok: true, file: new Blob(["%PDF"], { type: "application/pdf" }) });

  async getContext(): Promise<AdminReviewResult> {
    this.contextCalls += 1;
    return { ok: true, context: this.context };
  }

  async setDocumentVerdict(applicationId: string, documentId: string, verdict: DocumentVerdictValue) {
    this.verdictCalls.push({ applicationId, documentId, verdict });
    return this.verdictResult();
  }

  async downloadDocument(objectPath: string) {
    this.downloads.push(objectPath);
    return this.downloadResult();
  }

  async recordDecision(): Promise<RecordDecisionResult> {
    return { ok: false, code: "unavailable" };
  }
}

function fakeWindow() {
  const shown: { blob: Blob; name: string }[] = [];
  let cancelled = 0;
  const pending: PendingDocumentWindow = {
    show: (blob, name) => shown.push({ blob, name }),
    cancel: () => {
      cancelled += 1;
    }
  };
  const open = vi.fn<OpenDocumentWindow>(() => pending);
  return { open, shown, cancelled: () => cancelled };
}

function swr({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function renderReview(port: FakePort, openWindow: OpenDocumentWindow = fakeWindow().open) {
  return render(<ApplicationReview applicationId={APPLICATION_ID} port={port} openWindow={openWindow} />, {
    wrapper: swr
  });
}

async function kycSection() {
  return (await screen.findByRole("heading", { level: 2, name: "1 · KYC/KYB" })).closest("section") as HTMLElement;
}

function toggle(title: string, label: string) {
  return within(screen.getByRole("group", { name: `Estado de ${title}` })).getByRole("button", { name: label });
}

describe("admin review · 1 · KYC/KYB", () => {
  it("renders the section with its SIMULADO badge and one row per real document in template order", async () => {
    renderReview(new FakePort());
    const section = await kycSection();

    expect(within(section).getByText("SIMULADO")).toBeInTheDocument();
    const groups = within(section).getAllByRole("group");
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual([
      "Estado de Constancia de CUIT",
      "Estado de Declaraciones de ventas",
      "Estado de Foto 1"
    ]);
    expect(within(section).getByText("constancia.pdf")).toBeInTheDocument();
    expect(within(section).queryByText(/sintétic/i)).not.toBeInTheDocument();
  });

  it("reflects the persisted verdict in aria-pressed and leaves undecided documents unpressed", async () => {
    renderReview(new FakePort());
    await kycSection();

    expect(toggle("Declaraciones de ventas", "Pedir")).toHaveAttribute("aria-pressed", "true");
    expect(toggle("Declaraciones de ventas", "Válido")).toHaveAttribute("aria-pressed", "false");
    for (const label of ["Válido", "Pedir", "Inválido"]) {
      expect(toggle("Constancia de CUIT", label)).toHaveAttribute("aria-pressed", "false");
    }
  });

  it.each([
    ["Válido", "valid"],
    ["Pedir", "request"],
    ["Inválido", "invalid"]
  ] as const)("persists «%s» as %s and re-reads the review", async (label, value) => {
    const port = new FakePort();
    port.verdictResult = () => {
      port.context = {
        ...CONTEXT,
        documentVerdicts: [
          ...CONTEXT.documentVerdicts,
          { documentId: CUIT_ID, verdict: value, actor: "Admin Vaqcrow", updatedAt: "2026-10-07T13:00:00.000Z" }
        ]
      };
      return {
        ok: true,
        applied: true,
        verdict: { documentId: CUIT_ID, verdict: value, actor: "Admin Vaqcrow", updatedAt: "2026-10-07T13:00:00.000Z" }
      };
    };
    renderReview(port);
    await kycSection();

    fireEvent.click(toggle("Constancia de CUIT", label));

    await waitFor(() => expect(toggle("Constancia de CUIT", label)).toHaveAttribute("aria-pressed", "true"));
    expect(port.verdictCalls).toEqual([{ applicationId: APPLICATION_ID, documentId: CUIT_ID, verdict: value }]);
    await waitFor(() => expect(port.contextCalls).toBe(2));
  });

  it("disables every toggle while a verdict is being saved", async () => {
    const port = new FakePort();
    port.verdictResult = () => new Promise<SetDocumentVerdictResult>(() => {});
    renderReview(port);
    await kycSection();

    fireEvent.click(toggle("Constancia de CUIT", "Válido"));

    await waitFor(() => expect(toggle("Constancia de CUIT", "Válido")).toBeDisabled());
    expect(toggle("Declaraciones de ventas", "Inválido")).toBeDisabled();
    fireEvent.click(toggle("Declaraciones de ventas", "Inválido"));
    expect(port.verdictCalls).toHaveLength(1);
  });

  it.each(["approved", "rejected", "changes_requested"] as const)(
    "keeps the persisted verdicts visible but read-only once the review is %s",
    async (state) => {
      const port = new FakePort();
      port.context = { ...CONTEXT, state };
      renderReview(port);
      await kycSection();

      expect(toggle("Declaraciones de ventas", "Pedir")).toHaveAttribute("aria-pressed", "true");
      expect(toggle("Declaraciones de ventas", "Pedir")).toBeDisabled();
      expect(toggle("Constancia de CUIT", "Válido")).toBeDisabled();
    }
  );

  it("explains a 409 honestly and re-reads the review", async () => {
    const port = new FakePort();
    port.verdictResult = () => ({ ok: false, code: "state_conflict", actualState: "approved" });
    renderReview(port);
    await kycSection();

    fireEvent.click(toggle("Constancia de CUIT", "Válido"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta solicitud ya tiene una decisión registrada. No se modificó ningún dato."
    );
    await waitFor(() => expect(port.contextCalls).toBe(2));
    expect(toggle("Constancia de CUIT", "Válido")).toHaveAttribute("aria-pressed", "false");
  });

  it.each(["unavailable", "network"] as const)("shows a neutral error for %s and changes nothing", async (code) => {
    const port = new FakePort();
    port.verdictResult = () => ({ ok: false, code });
    renderReview(port);
    await kycSection();

    fireEvent.click(toggle("Constancia de CUIT", "Inválido"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar el estado del documento. No se modificó ningún dato."
    );
    expect(toggle("Constancia de CUIT", "Inválido")).toHaveAttribute("aria-pressed", "false");
    expect(toggle("Constancia de CUIT", "Inválido")).not.toBeDisabled();
  });

  it("opens a document through the authenticated download, never a public URL", async () => {
    const port = new FakePort();
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    port.downloadResult = () => ({ ok: true, file: blob });
    const window = fakeWindow();
    const { container } = renderReview(port, window.open);
    await kycSection();

    fireEvent.click(screen.getByRole("button", { name: "Abrir Constancia de CUIT" }));

    await waitFor(() => expect(window.shown).toEqual([{ blob, name: "constancia.pdf" }]));
    expect(window.open).toHaveBeenCalledWith({ contentType: "application/pdf" });
    expect(port.downloads).toEqual(["owner/cuit/b-constancia.pdf"]);
    expect(container.querySelector("a[href*='storage']")).toBeNull();
  });

  it("stays available to open documents once the review is decided", async () => {
    const port = new FakePort();
    port.context = { ...CONTEXT, state: "approved" };
    renderReview(port);
    await kycSection();

    expect(screen.getByRole("button", { name: "Abrir Foto 1" })).not.toBeDisabled();
  });

  it("cancels the pending window and shows a neutral error when the download fails", async () => {
    const port = new FakePort();
    port.downloadResult = () => ({ ok: false, code: "unavailable" });
    const window = fakeWindow();
    renderReview(port, window.open);
    await kycSection();

    fireEvent.click(screen.getByRole("button", { name: "Abrir Foto 1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos abrir el documento.");
    expect(window.shown).toEqual([]);
    expect(window.cancelled()).toBe(1);
  });

  it("says so when the application has no uploaded documents", async () => {
    const port = new FakePort();
    port.context = { ...CONTEXT, documents: [], documentVerdicts: [] };
    renderReview(port);
    const section = await kycSection();

    expect(within(section).getByText("No hay documentos cargados.")).toBeInTheDocument();
    expect(within(section).queryByRole("group")).not.toBeInTheDocument();
  });
});
