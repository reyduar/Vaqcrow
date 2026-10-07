import { describe, expect, it } from "vitest";
import type { HumanDecisionRecord } from "@vaqcrow/contracts";
import type { AdminReviewCompany } from "@/application/ports/admin-review-port";
import {
  DECISION_COPY,
  DECISION_OPTIONS,
  DECISION_REASON_MAX_LENGTH,
  DECISION_REASON_MIN_LENGTH,
  approvedLimitFor,
  buildDecisionRequest,
  decisionConfirmationBody,
  decisionFailureMessage,
  decisionFingerprint,
  decisionFormOpen,
  decisionStatusLine,
  formatApprovedLimit,
  validateDecision
} from "./decision";

const COMPANY: AdminReviewCompany = {
  name: "Panadería Horizonte SRL",
  cuit: "30-71234567-8",
  sector: "Alimentos",
  city: "Rosario",
  description: "Panadería de barrio.",
  goalArs: 12_000_000,
  revenueShare: 5,
  deadline: null
};

const RECORD = {
  decisionId: "44444444-4444-4444-8444-444444444444",
  applicationId: "22222222-2222-4222-8222-222222222222",
  outcome: "approved",
  actor: "Admin Vaqcrow",
  reason: "Ventas consistentes con lo declarado.",
  approvedLimitArs: 12_000_000,
  decidedAt: "2026-10-07T15:30:00.000Z",
  correlationId: "66666666-6666-4666-8666-666666666666"
} as unknown as HumanDecisionRecord;

describe("decision options and copy", () => {
  it("offers the template's three outcomes in order", () => {
    expect(DECISION_OPTIONS.map((option) => [option.value, option.label])).toEqual([
      ["approved", "Aprobar con límite"],
      ["changes_requested", "Requiere cambios"],
      ["rejected", "Rechazar"]
    ]);
  });

  it("keeps the template's fixed texts verbatim", () => {
    expect(DECISION_COPY.title).toBe("3 · Decisión humana");
    expect(DECISION_COPY.notice).toBe(
      "Esta decisión la registra una persona. La recomendación de IA no aprueba ni transfiere fondos."
    );
    expect(DECISION_COPY.reasonPlaceholder).toBe("Obligatoria. Queda visible en el detalle de la campaña.");
    expect(DECISION_COPY.limitLabel).toBe("Límite aprobado (ARS)");
  });
});

describe("approvedLimitFor (D7)", () => {
  it("is the PyME's declared goal", () => {
    expect(approvedLimitFor(COMPANY)).toBe(12_000_000);
  });

  it("is null without a company or with a goal the contract would refuse", () => {
    expect(approvedLimitFor(null)).toBeNull();
    expect(approvedLimitFor({ ...COMPANY, goalArs: 0 })).toBeNull();
    expect(approvedLimitFor({ ...COMPANY, goalArs: -5 })).toBeNull();
    expect(approvedLimitFor({ ...COMPANY, goalArs: 1.5 })).toBeNull();
    expect(approvedLimitFor({ ...COMPANY, goalArs: Number.MAX_SAFE_INTEGER + 2 })).toBeNull();
  });

  it("formats the limit with Argentine thousands separators", () => {
    expect(formatApprovedLimit(12_000_000)).toBe("12.000.000");
    expect(formatApprovedLimit(950)).toBe("950");
  });
});

describe("validateDecision", () => {
  it("requires an outcome", () => {
    const result = validateDecision({ outcome: null, reason: "Una razón suficiente.", approvedLimitArs: 1 });
    expect(result).toEqual({ ok: false, errors: { outcome: DECISION_COPY.outcomeRequired } });
  });

  it("requires at least 10 characters after trimming", () => {
    expect(DECISION_REASON_MIN_LENGTH).toBe(10);
    const short = validateDecision({ outcome: "rejected", reason: "   corta   ", approvedLimitArs: null });
    expect(short).toEqual({ ok: false, errors: { reason: DECISION_COPY.reasonTooShort } });
    const exact = validateDecision({ outcome: "rejected", reason: "  1234567890  ", approvedLimitArs: null });
    expect(exact).toEqual({ ok: true, input: { outcome: "rejected", reason: "1234567890", approvedLimitArs: null } });
  });

  it("refuses more than 1000 characters", () => {
    expect(DECISION_REASON_MAX_LENGTH).toBe(1000);
    const long = validateDecision({ outcome: "rejected", reason: "a".repeat(1001), approvedLimitArs: null });
    expect(long).toEqual({ ok: false, errors: { reason: DECISION_COPY.reasonTooLong } });
    expect(validateDecision({ outcome: "rejected", reason: "a".repeat(1000), approvedLimitArs: null }).ok).toBe(true);
  });

  it("sends the limit only for an approval", () => {
    expect(validateDecision({ outcome: "approved", reason: "Razón suficiente.", approvedLimitArs: 12_000_000 })).toEqual({
      ok: true,
      input: { outcome: "approved", reason: "Razón suficiente.", approvedLimitArs: 12_000_000 }
    });
    expect(
      validateDecision({ outcome: "changes_requested", reason: "Razón suficiente.", approvedLimitArs: 12_000_000 })
    ).toEqual({ ok: true, input: { outcome: "changes_requested", reason: "Razón suficiente.", approvedLimitArs: null } });
  });

  it("refuses an approval without a limit", () => {
    expect(validateDecision({ outcome: "approved", reason: "Razón suficiente.", approvedLimitArs: null })).toEqual({
      ok: false,
      errors: { outcome: DECISION_COPY.approvalUnavailable }
    });
  });

  it("reports both errors together", () => {
    expect(validateDecision({ outcome: null, reason: "", approvedLimitArs: null })).toEqual({
      ok: false,
      errors: { outcome: DECISION_COPY.outcomeRequired, reason: DECISION_COPY.reasonTooShort }
    });
  });
});

describe("buildDecisionRequest", () => {
  it("has exactly the four body keys and never an actor", () => {
    const request = buildDecisionRequest("44444444-4444-4444-8444-444444444444", {
      outcome: "rejected",
      reason: "Razón suficiente.",
      approvedLimitArs: null
    });
    expect(request).toStrictEqual({
      decisionId: "44444444-4444-4444-8444-444444444444",
      outcome: "rejected",
      reason: "Razón suficiente.",
      approvedLimitArs: null
    });
    expect(Object.keys(request).sort()).toEqual(["approvedLimitArs", "decisionId", "outcome", "reason"]);
  });

  it("fingerprints equal inputs equally and different inputs differently", () => {
    const base = { outcome: "rejected" as const, reason: "Razón suficiente.", approvedLimitArs: null };
    expect(decisionFingerprint(base)).toBe(decisionFingerprint({ ...base }));
    expect(decisionFingerprint(base)).not.toBe(decisionFingerprint({ ...base, reason: "Otra razón distinta." }));
  });
});

describe("decisionConfirmationBody", () => {
  it("follows the template for each outcome, attributed to the signed-in admin", () => {
    expect(
      decisionConfirmationBody({ outcome: "approved", reason: "x".repeat(10), approvedLimitArs: 12_000_000 }, "M. Pereyra")
    ).toBe("Aprobada con límite ARS 12.000.000. Queda atribuida a M. Pereyra y visible para la PyME y los aportantes.");
    expect(
      decisionConfirmationBody({ outcome: "changes_requested", reason: "x".repeat(10), approvedLimitArs: null }, "M. Pereyra")
    ).toBe("Requiere cambios. Queda atribuida a M. Pereyra y visible para la PyME y los aportantes.");
    expect(decisionConfirmationBody({ outcome: "rejected", reason: "x".repeat(10), approvedLimitArs: null }, "M. Pereyra")).toBe(
      "Rechazada. Queda atribuida a M. Pereyra y visible para la PyME y los aportantes."
    );
  });

  it("stays truthful without a known name", () => {
    expect(decisionConfirmationBody({ outcome: "rejected", reason: "x".repeat(10), approvedLimitArs: null }, null)).toBe(
      "Rechazada. Queda atribuida a tu cuenta de administrador y visible para la PyME y los aportantes."
    );
    expect(decisionConfirmationBody({ outcome: "rejected", reason: "x".repeat(10), approvedLimitArs: null }, "   ")).toBe(
      "Rechazada. Queda atribuida a tu cuenta de administrador y visible para la PyME y los aportantes."
    );
  });
});

describe("decisionStatusLine", () => {
  it("uses the server's actor and date with the outcome label", () => {
    expect(decisionStatusLine(RECORD)).toBe("Registrada por Admin Vaqcrow · 07/10/2026 12:30 · Aprobada");
    expect(decisionStatusLine({ ...RECORD, outcome: "changes_requested", approvedLimitArs: null })).toBe(
      "Registrada por Admin Vaqcrow · 07/10/2026 12:30 · Requiere cambios"
    );
    expect(decisionStatusLine({ ...RECORD, outcome: "rejected", approvedLimitArs: null })).toBe(
      "Registrada por Admin Vaqcrow · 07/10/2026 12:30 · Rechazada"
    );
  });
});

describe("decisionFormOpen", () => {
  it("is open only in human review without a recorded decision", () => {
    expect(decisionFormOpen("human_review", null)).toBe(true);
    expect(decisionFormOpen("human_review", RECORD)).toBe(false);
    for (const state of ["draft", "awaiting_assessment", "approved", "changes_requested", "rejected"] as const) {
      expect(decisionFormOpen(state, null)).toBe(false);
    }
  });
});

describe("decisionFailureMessage", () => {
  it("is honest about a state conflict", () => {
    expect(decisionFailureMessage({ ok: false, code: "state_conflict", actualState: "approved" })).toBe(
      DECISION_COPY.alreadyDecided
    );
    expect(decisionFailureMessage({ ok: false, code: "state_conflict", actualState: "awaiting_assessment" })).toBe(
      DECISION_COPY.notInReview
    );
  });

  it("is neutral for every other failure and never claims a recorded decision", () => {
    expect(decisionFailureMessage({ ok: false, code: "not_found" })).toBe(DECISION_COPY.notFound);
    expect(decisionFailureMessage({ ok: false, code: "invalid_request" })).toBe(DECISION_COPY.invalidRequest);
    expect(decisionFailureMessage({ ok: false, code: "idempotency_conflict" })).toBe(DECISION_COPY.notRecorded);
    expect(decisionFailureMessage({ ok: false, code: "unavailable" })).toBe(DECISION_COPY.unconfirmed);
    expect(decisionFailureMessage({ ok: false, code: "network" })).toBe(DECISION_COPY.unconfirmed);
    const failures = [
      DECISION_COPY.alreadyDecided,
      DECISION_COPY.notInReview,
      DECISION_COPY.notFound,
      DECISION_COPY.invalidRequest,
      DECISION_COPY.notRecorded,
      DECISION_COPY.unconfirmed
    ];
    for (const message of failures) expect(message).toMatch(/no se registró|No pudimos confirmar/i);
  });
});
