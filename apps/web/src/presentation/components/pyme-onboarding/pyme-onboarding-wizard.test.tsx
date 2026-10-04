import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { SmeRequest } from "@vaqcrow/contracts";
import { describe, expect, it, vi } from "vitest";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import { FakeAiEvaluation } from "@/test/fake-ai-evaluation";
import { FakeBusiness } from "@/test/fake-business";
import { FakeKyc } from "@/test/fake-kyc";
import { FakeUpload } from "@/test/fake-upload";
import { FakeWallet } from "@/test/fake-wallet";
import { PymeOnboardingWizard } from "./pyme-onboarding-wizard";

function renderWizard(fake = new FakeKyc()) {
  const onBack = vi.fn();
  render(<PymeOnboardingWizard kyc={fake} onBack={onBack} />);
  return { fake, onBack };
}

function pdfFile(name: string): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: "application/pdf" });
}

async function uploadRequiredDocuments() {
  for (const title of ["Declaraciones de ventas", "Constancia de CUIT", "Estatuto"]) {
    await act(async () => {
      fireEvent.change(screen.getByLabelText(title), { target: { files: [pdfFile(`${title}.pdf`)] } });
    });
  }
}

async function advanceToRegistration(kyc = new FakeKyc()) {
  const release = kyc.holdNextVerify();
  startVerification();
  await act(async () => {
    release();
  });
  await screen.findByText("KYC aprobado · SIMULADO");
  fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
  return kyc;
}

const SAVED_REQUEST: SmeRequest = {
  smeReference: "30712345678",
  declaredTotalArs: 27138250,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

function gateway(overrides: Partial<SmeRequestGateway> = {}): SmeRequestGateway {
  return {
    submit: vi.fn().mockResolvedValue({ applicationId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10", request: SAVED_REQUEST }),
    load: vi.fn(),
    ...overrides
  };
}

function selectDocument(value: "person_a" | "person_b") {
  fireEvent.change(screen.getByLabelText("Documento"), { target: { value } });
}

function startVerification(name = "Iniciar verificación simulada") {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("PymeOnboardingWizard shell", () => {
  it("renders the Volver action, the four-step stepper and the on-screen step 1", () => {
    renderWizard();

    expect(screen.getByRole("button", { name: "Volver a la pantalla anterior" })).toBeInTheDocument();

    const stepper = screen.getByRole("list", { name: "Pasos del registro" });
    expect(within(stepper).getAllByRole("listitem")).toHaveLength(4);
    const current = within(stepper).getByRole("listitem", { current: "step" });
    expect(current).toHaveTextContent("PASO 1");
    expect(within(current).getByText("KYC")).toBeInTheDocument();
    expect(within(stepper).getByText("Registro PyME")).toBeInTheDocument();
    expect(within(stepper).getByText("Evaluación AI")).toBeInTheDocument();
    expect(within(stepper).getByText("Revisión humana")).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 1, name: "Verificación de identidad" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "KYC/KYB de la persona responsable y de la empresa. En esta demo el resultado es simulado y no se procesa ningún documento real."
      )
    ).toBeInTheDocument();
  });

  it("invokes onBack from the Volver action", () => {
    const { onBack } = renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Volver a la pantalla anterior" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders the synthetic-identity dropzone, the labelled select and both buttons while idle", () => {
    renderWizard();

    expect(screen.getByText("Elegí un documento de prueba")).toBeInTheDocument();
    expect(
      screen.getByText("Usamos identidades sintéticas para que la demo nunca pida datos personales reales.")
    ).toBeInTheDocument();

    const select = screen.getByLabelText("Documento");
    expect(select).toHaveValue("person_a");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "DNI sintético · Persona A (responsable)",
      "DNI sintético · Persona B (socia)"
    ]);

    expect(screen.getByRole("button", { name: "Iniciar verificación simulada" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Usar archivo de prueba" })).toBeEnabled();
  });

  it("renders the template's KYC aside and the canonical simulated-result note", () => {
    renderWizard();

    const aside = screen.getByRole("complementary");
    expect(within(aside).getByText("¿POR QUÉ KYC?")).toBeInTheDocument();
    expect(
      within(aside).getByText(
        "En un producto real, conocer a la persona y a la empresa previene fraude y lavado de dinero antes de publicar una campaña."
      )
    ).toBeInTheDocument();
    expect(aside).toHaveTextContent(
      "En esta demo el paso existe para mostrar el flujo: el resultado queda marcado como SIMULADO en cada pantalla donde aparece."
    );

    expect(
      screen.getByText("Resultado simulado para esta demo; no constituye una verificación de identidad")
    ).toBeInTheDocument();
  });
});

describe("PymeOnboardingWizard KYC state machine", () => {
  it("shows the busy status with the simulated provider and disables both buttons", async () => {
    const fake = new FakeKyc();
    const release = fake.holdNextVerify();
    renderWizard(fake);

    startVerification();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Verificando con el adaptador simulado…");
    expect(status).toHaveTextContent("Adaptador KYC simulado v1");
    expect(screen.getByRole("button", { name: "Verificando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Elegir otro documento" })).toBeDisabled();

    expect(fake.calls).toEqual([{ document: "person_a" }]);

    await act(async () => {
      release();
    });
  });

  it("starts the verification from the secondary 'Usar archivo de prueba' action too", () => {
    const fake = new FakeKyc();
    fake.holdNextVerify();
    renderWizard(fake);

    startVerification("Usar archivo de prueba");

    expect(screen.getByRole("status")).toHaveTextContent("Verificando con el adaptador simulado…");
    expect(fake.calls).toEqual([{ document: "person_a" }]);
  });

  it("renders the approved result with its reference and provider, then advances or resets", async () => {
    const fake = new FakeKyc();
    fake.seedResult("person_a", {
      outcome: "approved",
      reference: "kyc:PH-2026-0001",
      provider: "Adaptador KYC simulado v1"
    });
    const release = fake.holdNextVerify();
    renderWizard(fake);

    startVerification();
    await act(async () => {
      release();
    });

    expect(await screen.findByText("KYC aprobado · SIMULADO")).toBeInTheDocument();
    expect(screen.getByText("Identidad y empresa verificadas por el adaptador simulado.")).toBeInTheDocument();
    expect(screen.getByText("Referencia")).toBeInTheDocument();
    expect(screen.getByText("kyc:PH-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Proveedor")).toBeInTheDocument();
    expect(screen.getByText("Adaptador KYC simulado v1")).toBeInTheDocument();

    // "Elegir otro documento" returns to the idle dropzone.
    fireEvent.click(screen.getByRole("button", { name: "Elegir otro documento" }));
    expect(screen.getByLabelText("Documento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar verificación simulada" })).toBeInTheDocument();
  });

  it("advances to step 2 'Registrá tu PyME' after an approved KYC and marks KYC done", async () => {
    const fake = new FakeKyc();
    const release = fake.holdNextVerify();
    renderWizard(fake);

    startVerification();
    await act(async () => {
      release();
    });
    await screen.findByText("KYC aprobado · SIMULADO");

    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));

    const stepper = screen.getByRole("list", { name: "Pasos del registro" });
    const items = within(stepper).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).not.toHaveAttribute("aria-current");
    const current = within(stepper).getByRole("listitem", { current: "step" });
    expect(within(current).getByText("Registro PyME")).toBeInTheDocument();
    expect(within(stepper).getByText("KYC")).toBeInTheDocument();

    expect(screen.queryByRole("heading", { level: 1, name: "Verificación de identidad" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Registrá tu PyME" })).toBeInTheDocument();
    // «Volver» stays reachable on step 2 (registered deviation: no route of its own).
    expect(screen.getByRole("button", { name: "Volver a la pantalla anterior" })).toBeInTheDocument();
  });

  it("renders 'Requiere cambios' for the partner document and retries from the primary action", async () => {
    const fake = new FakeKyc();
    fake.seedResult("person_b", {
      outcome: "requires_changes",
      reference: "kyc:PH-2026-0002",
      provider: "Adaptador KYC simulado v1"
    });
    const release = fake.holdNextVerify();
    renderWizard(fake);

    selectDocument("person_b");
    startVerification();
    await act(async () => {
      release();
    });

    expect(await screen.findByText("Requiere cambios · SIMULADO")).toBeInTheDocument();
    expect(
      screen.getByText("El documento de prueba no coincide con la razón social. Elegí otro documento y volvé a intentar.")
    ).toBeInTheDocument();
    expect(fake.calls).toEqual([{ document: "person_b" }]);

    fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
    expect(screen.getByLabelText("Documento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar verificación simulada" })).toBeInTheDocument();
  });

  it("returns to idle when the adapter rejects, so the person can retry", async () => {
    const fake = new FakeKyc();
    fake.failNext();
    renderWizard(fake);

    startVerification();
    await screen.findByRole("button", { name: "Iniciar verificación simulada" });

    expect(screen.getByLabelText("Documento")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("PymeOnboardingWizard steps 3 and 4", () => {
  it("advances from a valid step-2 submit to the busy evaluation and then to the review", async () => {
    const kyc = new FakeKyc();
    const ai = new FakeAiEvaluation();
    const releaseAi = ai.holdNextEvaluate();
    render(
      <PymeOnboardingWizard
        kyc={kyc}
        upload={new FakeUpload()}
        ai={ai}
        wallet={new FakeWallet({ publicKey: "GBXK1234567890ABCD7Q2M" })}
        gateway={gateway()}
        onBack={vi.fn()}
      />
    );

    await advanceToRegistration(kyc);
    fireEvent.click(screen.getByRole("button", { name: "Completar con datos de ejemplo" }));
    await uploadRequiredDocuments();
    fireEvent.click(screen.getByRole("button", { name: "Enviar a evaluación AI" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Evaluación AI" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Analizando tu solicitud…");
    expect(ai.calls).toEqual([{ smeReference: "30712345678", sales: expect.any(Array) }]);

    await act(async () => {
      releaseAi();
    });

    fireEvent.click(await screen.findByRole("button", { name: /Continuar/ }));

    expect(screen.getByRole("heading", { level: 1, name: "Qué pasa ahora" })).toBeInTheDocument();
    const current = within(screen.getByRole("list", { name: "Pasos del registro" })).getByRole("listitem", {
      current: "step"
    });
    expect(within(current).getByText("Revisión humana")).toBeInTheDocument();
  });

  it("persists the company and then sends the request from step 4", async () => {
    const kyc = new FakeKyc();
    const ai = new FakeAiEvaluation();
    const business = new FakeBusiness();
    const gw = gateway();
    render(
      <PymeOnboardingWizard
        kyc={kyc}
        upload={new FakeUpload()}
        ai={ai}
        wallet={new FakeWallet({ publicKey: "GBXK1234567890ABCD7Q2M" })}
        gateway={gw}
        business={business}
        onBack={vi.fn()}
      />
    );

    await advanceToRegistration(kyc);
    fireEvent.click(screen.getByRole("button", { name: "Completar con datos de ejemplo" }));
    await uploadRequiredDocuments();
    fireEvent.click(screen.getByRole("button", { name: "Enviar a evaluación AI" }));
    fireEvent.click(await screen.findByRole("button", { name: /Continuar/ }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enviar a revisión/ }));
    });

    expect(business.creates).toHaveLength(1);
    expect(gw.submit).toHaveBeenCalledWith(SAVED_REQUEST);
    expect(screen.getByText("Solicitud enviada a revisión. Te avisamos cuando haya una decisión.")).toBeInTheDocument();
  });

  it("returns to step 2 with Corregir datos and keeps the loaded values", async () => {
    const kyc = new FakeKyc();
    const ai = new FakeAiEvaluation();
    render(<PymeOnboardingWizard kyc={kyc} upload={new FakeUpload()} ai={ai} wallet={new FakeWallet()} onBack={vi.fn()} />);

    await advanceToRegistration(kyc);
    fireEvent.click(screen.getByRole("button", { name: "Completar con datos de ejemplo" }));
    await uploadRequiredDocuments();
    fireEvent.click(screen.getByRole("button", { name: "Enviar a evaluación AI" }));

    fireEvent.click(await screen.findByRole("button", { name: /Corregir datos/ }));

    expect(screen.getByRole("heading", { level: 1, name: "Registrá tu PyME" })).toBeInTheDocument();
    expect(screen.getByLabelText("Razón social")).toHaveValue("Panadería Horizonte SRL");
  });
});
