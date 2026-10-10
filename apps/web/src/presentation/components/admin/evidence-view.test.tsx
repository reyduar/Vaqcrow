import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminApplicationEvidence } from "@vaqcrow/contracts";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import type { AdminEvidencePort, GetEvidenceResult } from "@/application/ports/admin-review-port";
import { EvidenceView } from "./evidence-view";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222" as AdminApplicationEvidence["applicationId"];

const EVIDENCE: AdminApplicationEvidence = {
  applicationId: APPLICATION_ID,
  applicationState: "approved",
  smeReference: "sme-001",
  companyName: "Panadería Horizonte SRL",
  decision: null,
  deployment: null,
  vault: null,
  contributions: [],
  distributions: [],
  reconciliation: null
};

function swr({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function portOf(respond: () => GetEvidenceResult | Promise<GetEvidenceResult>) {
  const calls: string[] = [];
  const port: AdminEvidencePort = {
    async getEvidence(applicationId) {
      calls.push(applicationId);
      return respond();
    }
  };
  return { port, calls };
}

function renderView(port: AdminEvidencePort) {
  return render(<EvidenceView applicationId={APPLICATION_ID} port={port} />, { wrapper: swr });
}

describe("EvidenceView", () => {
  it("shows a loading skeleton while the evidence is in flight", () => {
    const { port } = portOf(() => new Promise<GetEvidenceResult>(() => {}));
    renderView(port);
    expect(screen.getByRole("status").textContent).toContain("Cargando evidencia…");
  });

  it("renders the header, TESTNET badge, trust note and chain", async () => {
    const { port, calls } = portOf(() => ({ ok: true, evidence: EVIDENCE }));
    renderView(port);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Evidencia: Panadería Horizonte SRL" })
    ).toBeTruthy();
    expect(screen.getByText(`sme-001 · ${APPLICATION_ID}`)).toBeTruthy();
    // The header pill and the «Solicitud» step both state the review state.
    expect(screen.getAllByText("Aprobada")).toHaveLength(2);
    expect(screen.getByText("TESTNET · Activos sin valor económico")).toBeTruthy();
    expect(
      screen.getByText("El hash demuestra ejecución técnica en Testnet; no representa una inversión ni dinero real")
    ).toBeTruthy();
    expect(screen.getByRole("list", { name: "Cadena de evidencia" })).toBeTruthy();
    expect(calls).toEqual([APPLICATION_ID]);
  });

  it("offers breadcrumbs back to the queue and to the review", async () => {
    const { port } = portOf(() => ({ ok: true, evidence: EVIDENCE }));
    renderView(port);
    await screen.findByRole("heading", { level: 1 });
    const nav = screen.getByRole("navigation", { name: "Ruta" });
    expect(nav.querySelector('a[href="/admin/pymes"]')?.textContent).toBe("PyMEs");
    expect(nav.querySelector(`a[href="/admin/pymes/${APPLICATION_ID}"]`)?.textContent).toBe("Revisión");
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe("Evidencia");
  });

  it("shows the not-found state with a way back to the queue, without a retry", async () => {
    const { port } = portOf(() => ({ ok: false, code: "not_found" }));
    renderView(port);
    expect(await screen.findByText("No encontramos esta solicitud.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver a PyMEs" }).getAttribute("href")).toBe("/admin/pymes");
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });

  it("shows the error state on unavailable and re-reads on retry", async () => {
    let response: GetEvidenceResult = { ok: false, code: "unavailable" };
    const { port, calls } = portOf(() => response);
    renderView(port);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No pudimos cargar la evidencia.");
    expect(alert.textContent).toContain("No se modificó ningún dato.");

    response = { ok: true, evidence: EVIDENCE };
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(await screen.findByRole("heading", { level: 1, name: "Evidencia: Panadería Horizonte SRL" })).toBeTruthy();
  });

  it("treats a network failure like any other retryable error", async () => {
    const { port } = portOf(() => ({ ok: false, code: "network" }));
    renderView(port);
    expect((await screen.findByRole("alert")).textContent).toContain("No pudimos cargar la evidencia.");
  });
});
