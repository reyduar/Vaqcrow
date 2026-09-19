import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HumanDecisionRecordView } from "./human-decision-record";

const decision = {
  decisionId: "11111111-1111-4111-8111-111111111111",
  applicationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  outcome: "approved",
  actor: "operador-demo",
  reason: "Evidencia revisada",
  approvedLimitArs: 5_000_000,
  decidedAt: "2026-09-19T12:00:00.000Z",
  correlationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
} as never;

describe("HumanDecisionRecordView", () => {
  it("shows the recorded actor, reason, limit, server timestamp and correlation id", () => {
    render(<HumanDecisionRecordView recorded={{ applied: true, decision }} />);

    expect(screen.getByText("operador-demo")).toBeInTheDocument();
    expect(screen.getByText("Evidencia revisada")).toBeInTheDocument();
    expect(screen.getByText(/5\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText("2026-09-19T12:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toBeInTheDocument();
  });

  it("states the outcome as a human decision, never as an AI approval", () => {
    render(<HumanDecisionRecordView recorded={{ applied: true, decision }} />);

    expect(screen.getByRole("status")).toHaveTextContent(/decisión humana registrada/i);
    expect(screen.getByText("Aprobada")).toBeInTheDocument();
  });

  it("tells the user when this was an idempotent replay of an earlier record", () => {
    render(<HumanDecisionRecordView recorded={{ applied: false, decision }} />);

    expect(screen.getByText(/ya estaba registrada/i)).toBeInTheDocument();
  });

  it("shows no limit for non-approved outcomes", () => {
    const rejected = { ...(decision as object), outcome: "rejected", approvedLimitArs: null } as never;
    render(<HumanDecisionRecordView recorded={{ applied: true, decision: rejected }} />);

    expect(screen.getByText("Rechazada")).toBeInTheDocument();
    expect(screen.getByText(/Sin límite/)).toBeInTheDocument();
  });
});
