import { describe, expect, it } from "vitest";
import {
  REVIEW_STEP_COPY,
  reviewNextSteps,
  shortPublicKey,
  smeReferenceFor,
  toSmeRequestValues
} from "./review-step";
import { DEMO_VALUES, EMPTY_REGISTRATION_VALUES } from "./registration-step";

describe("REVIEW_STEP_COPY", () => {
  it("carries the template's step-4 copy verbatim", () => {
    expect(REVIEW_STEP_COPY.notSentTitle).toBe("Revisá y enviá tu solicitud.");
    expect(REVIEW_STEP_COPY.notSentBody).toBe("Todavía no fue enviada a revisión.");
    expect(REVIEW_STEP_COPY.heading).toBe("Qué pasa ahora");
    expect(REVIEW_STEP_COPY.sentBannerTitle).toBe("Solicitud enviada · en revisión.");
    expect(REVIEW_STEP_COPY.sentBannerBody).toBe("Todavía no está aprobada ni publicada.");
    expect(REVIEW_STEP_COPY.sentSuccess).toBe(
      "Solicitud enviada a revisión. Te avisamos cuando haya una decisión."
    );
    expect(REVIEW_STEP_COPY.send).toBe("Enviar a revisión");
    expect(REVIEW_STEP_COPY.edit).toBe("Revisar lo cargado");
    expect(REVIEW_STEP_COPY.goToCompany).toBe("Ir a Mi campaña");
    expect(REVIEW_STEP_COPY.connectWallet).toBe("Conectar Freighter");
    expect(REVIEW_STEP_COPY.walletAlert).toBe(
      "Conectá tu wallet Freighter para poder enviar la solicitud a revisión."
    );
  });
});

describe("shortPublicKey", () => {
  it("keeps the first and last four characters, like the template's GBXK…7Q2M", () => {
    expect(shortPublicKey("GBXK1234567890ABCD7Q2M")).toBe("GBXK…7Q2M");
  });
});

describe("reviewNextSteps", () => {
  const base = { sent: false, walletConnected: false, walletTried: false, publicKey: null } as const;

  it("renders the five template steps and their pending states before sending", () => {
    const steps = reviewNextSteps(base);

    expect(steps.map((step) => step.title)).toEqual([
      "Solicitud lista",
      "Evaluación de IA",
      "Conectar Freighter",
      "Revisión humana",
      "Apertura de la bóveda"
    ]);
    expect(steps.map((step) => step.state)).toEqual([
      "Pendiente",
      "Completo",
      "Pendiente",
      "Pendiente",
      "Pendiente"
    ]);
    expect(steps.map((step) => step.tone)).toEqual(["none", "ok", "none", "none", "none"]);
  });

  it("marks the wallet Obligatorio only after a blocked send attempt", () => {
    const steps = reviewNextSteps({ ...base, walletTried: true });
    const wallet = steps[2]!;
    expect(wallet.state).toBe("Obligatorio");
    expect(wallet.tone).toBe("err");
    expect(wallet.icon).toBe("wallet");
  });

  it("marks the wallet and the request complete once connected", () => {
    const steps = reviewNextSteps({
      sent: false,
      walletConnected: true,
      walletTried: true,
      publicKey: "GBXK1234567890ABCD7Q2M"
    });

    expect(steps[0]!.state).toBe("Pendiente");
    expect(steps[2]!).toMatchObject({ state: "Completo", tone: "ok" });
    expect(steps[2]!.body).toContain("GBXK…7Q2M");
  });

  it("moves the request and the human review forward after sending", () => {
    const steps = reviewNextSteps({
      sent: true,
      walletConnected: true,
      walletTried: true,
      publicKey: "GBXK1234567890ABCD7Q2M"
    });

    expect(steps[0]!).toMatchObject({ title: "Solicitud recibida", state: "Completo", tone: "ok" });
    expect(steps[3]!).toMatchObject({ title: "Revisión humana", state: "En proceso", tone: "warn" });
    expect(steps[4]!).toMatchObject({ title: "Apertura de la bóveda", state: "Pendiente", tone: "none" });
  });
});

describe("toSmeRequestValues", () => {
  it("sums the non-empty months and names the eight-month 2026 window", () => {
    const values = toSmeRequestValues(DEMO_VALUES);

    expect(values.declaredTotalArs).toBe("27138250");
    expect(values.periodStart).toBe("2026-01");
    expect(values.periodEnd).toBe("2026-08");
  });

  it("reports a non-numeric string as NaN so the gateway rejects it", () => {
    const values = toSmeRequestValues({ ...EMPTY_REGISTRATION_VALUES, sales: ["abc", "", "", "", "", "", "", ""] });
    expect(values.declaredTotalArs).toBe("NaN");
  });
});

describe("smeReferenceFor", () => {
  it("uses the CUIT digits and falls back to the company name", () => {
    expect(smeReferenceFor(DEMO_VALUES)).toBe("30712345678");
    expect(smeReferenceFor({ ...EMPTY_REGISTRATION_VALUES, name: "Panadería Horizonte SRL" })).toBe(
      "Panadería Horizonte SRL"
    );
  });
});
