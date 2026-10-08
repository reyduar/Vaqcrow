import { describe, expect, it } from "vitest";
import type { AdminDeployment, DeployFailureCode } from "@/application/ports/admin-review-port";
import {
  DEPLOYMENT_COPY,
  deployFailureMessage,
  deploymentCanDeploy,
  deploymentDetails,
  deploymentErrorText,
  deploymentPanelVisible,
  deploymentShouldPoll,
  deploymentStatusFor,
  type DeploymentRead
} from "./deployment";

const BASE: AdminDeployment = {
  applicationId: "22222222-2222-4222-8222-222222222222",
  state: "pending",
  attempts: 0,
  campaignId: null,
  lastError: null,
  retryable: false,
  createdAt: "2026-10-07T15:30:00.000Z",
  updatedAt: "2026-10-07T15:31:00.000Z"
};

const record = (patch: Partial<AdminDeployment>): DeploymentRead => ({
  kind: "record",
  deployment: { ...BASE, ...patch }
});

describe("deploymentPanelVisible", () => {
  it("shows the panel for an approved review, whatever the read", () => {
    expect(deploymentPanelVisible("approved", undefined)).toBe(true);
    expect(deploymentPanelVisible("approved", { kind: "missing" })).toBe(true);
  });

  it("hides it for any other state unless a deployment record exists", () => {
    for (const state of ["draft", "awaiting_assessment", "human_review", "changes_requested", "rejected"] as const) {
      expect(deploymentPanelVisible(state, undefined)).toBe(false);
      expect(deploymentPanelVisible(state, { kind: "missing" })).toBe(false);
      expect(deploymentPanelVisible(state, record({}))).toBe(true);
    }
  });
});

describe("deploymentStatusFor", () => {
  it("uses the D3 labels verbatim, in order", () => {
    expect(deploymentStatusFor({ ...BASE, state: "pending" }).label).toBe("Pendiente de confirmación");
    expect(deploymentStatusFor({ ...BASE, state: "deploying" }).label).toBe("Desplegando bóveda");
    expect(deploymentStatusFor({ ...BASE, state: "confirmed" }).label).toBe("Bóveda confirmada / PyME publicada");
    expect(deploymentStatusFor({ ...BASE, state: "failed" }).label).toBe("Despliegue fallido");
  });

  it("reserves the success tone for the ledger-confirmed outcome only", () => {
    expect(deploymentStatusFor({ ...BASE, state: "confirmed" }).tone).toBe("success");
    for (const state of ["pending", "deploying", "failed"] as const) {
      expect(deploymentStatusFor({ ...BASE, state }).tone).not.toBe("success");
    }
    expect(deploymentStatusFor({ ...BASE, state: "failed" }).tone).toBe("critical");
  });

  it("gives every state its own icon so meaning never lives in colour alone", () => {
    const icons = (["pending", "deploying", "confirmed", "failed"] as const).map(
      (state) => deploymentStatusFor({ ...BASE, state }).icon
    );
    expect(new Set(icons).size).toBe(4);
  });

  it("offers Reintentar exactly when the server reports the deployment retryable", () => {
    expect(deploymentStatusFor({ ...BASE, state: "failed", retryable: true }).canRetry).toBe(true);
    expect(deploymentStatusFor({ ...BASE, state: "deploying", retryable: true }).canRetry).toBe(true);
    for (const state of ["pending", "deploying", "confirmed"] as const) {
      expect(deploymentStatusFor({ ...BASE, state }).canRetry).toBe(false);
    }
  });

  it("describes a stale deploying attempt honestly, without claiming a failure on-chain or moved funds (U8)", () => {
    const view = deploymentStatusFor({ ...BASE, state: "deploying", retryable: true });
    expect(view.label).toBe(DEPLOYMENT_COPY.staleLabel);
    expect(view.label).not.toBe("Desplegando bóveda");
    expect(view.tone).not.toBe("success");
    expect(view.message).toMatch(/no terminó/);
    expect(view.message).toMatch(/Reintentar/);
    expect(view.message).not.toMatch(/falló en|fondos|se transfiri|confirmada en/i);
  });

  it("never claims confirmation before the confirmed state", () => {
    for (const state of ["pending", "deploying", "failed"] as const) {
      const { message } = deploymentStatusFor({ ...BASE, state, lastError: "unavailable" });
      expect(message).not.toMatch(/confirmada en|publicada/i);
    }
    expect(deploymentStatusFor({ ...BASE, state: "confirmed", campaignId: "x" }).message).toMatch(/Testnet/);
  });

  it("explains a failure with the honest copy of its last error", () => {
    const view = deploymentStatusFor({ ...BASE, state: "failed", lastError: "wallet_required" });
    expect(view.message).toContain(deploymentErrorText("wallet_required"));
  });
});

describe("deploymentErrorText", () => {
  const codes = [
    "owner_unresolved",
    "terms_unavailable",
    "wallet_required",
    "goal_limit_exceeded",
    "rate_unavailable",
    "unavailable",
    "application_not_found",
    "application_not_approved"
  ];

  it("has a distinct Spanish text for every known code", () => {
    const texts = codes.map(deploymentErrorText);
    expect(new Set(texts).size).toBe(codes.length);
    for (const text of texts) expect(text.length).toBeGreaterThan(10);
  });

  it("falls back to a neutral text for an unknown or absent code, never echoing it", () => {
    expect(deploymentErrorText(null)).toBe(DEPLOYMENT_COPY.unknownError);
    expect(deploymentErrorText("db exploded: password=x")).toBe(DEPLOYMENT_COPY.unknownError);
  });

  it("never claims that funds moved", () => {
    for (const code of [...codes, null]) expect(deploymentErrorText(code)).not.toMatch(/se transfiri|se movieron los fondos|fondos enviados/i);
  });

  it("does not blame the PyME for platform-side failures", () => {
    for (const code of ["rate_unavailable", "unavailable"]) {
      expect(deploymentErrorText(code)).toMatch(/no depende de la PyME/);
    }
  });
});

describe("deployFailureMessage", () => {
  const codes: DeployFailureCode[] = [
    "application_not_found",
    "application_not_approved",
    "owner_unresolved",
    "terms_unavailable",
    "wallet_required",
    "goal_limit_exceeded",
    "rate_unavailable",
    "unavailable",
    "network"
  ];

  it("states that the retry did not confirm the vault, for every code", () => {
    for (const code of codes) expect(deployFailureMessage(code)).toMatch(/no se (completó|reintentó)|No pudimos confirmar/);
  });

  it("says a deployment is already in progress without claiming its outcome (U8)", () => {
    const message = deployFailureMessage("deployment_in_progress");
    expect(message).toMatch(/en curso/);
    expect(message).not.toMatch(/confirmada|falló|fondos/i);
  });

  it("reuses the honest reason for a 422 refusal", () => {
    expect(deployFailureMessage("terms_unavailable")).toContain(deploymentErrorText("terms_unavailable"));
  });
});

describe("deploymentDetails", () => {
  it("lists attempts and timestamps in Argentina time", () => {
    const details = deploymentDetails({ ...BASE, attempts: 2 });
    expect(details).toEqual([
      { term: "Intentos", value: "2" },
      { term: "Registrado", value: "07/10/2026 12:30" },
      { term: "Última actualización", value: "07/10/2026 12:31" }
    ]);
  });

  it("adds the last error for a failure and the campaign id when confirmed", () => {
    expect(deploymentDetails({ ...BASE, state: "failed", attempts: 1, lastError: "rate_unavailable" })).toContainEqual({
      term: "Último error",
      value: deploymentErrorText("rate_unavailable")
    });
    expect(deploymentDetails({ ...BASE, state: "confirmed", attempts: 1, campaignId: "camp-1" })).toContainEqual({
      term: "ID de campaña",
      value: "camp-1"
    });
    expect(deploymentDetails({ ...BASE, state: "pending" }).map((entry) => entry.term)).not.toContain("ID de campaña");
  });
});

describe("deploymentShouldPoll", () => {
  it("polls only while the deployment is pending or deploying", () => {
    expect(deploymentShouldPoll(record({ state: "pending" }))).toBe(true);
    expect(deploymentShouldPoll(record({ state: "deploying" }))).toBe(true);
    // A stale attempt waits for the admin's Reintentar instead of polling forever (U8).
    expect(deploymentShouldPoll(record({ state: "deploying", retryable: true }))).toBe(false);
    expect(deploymentShouldPoll(record({ state: "confirmed" }))).toBe(false);
    expect(deploymentShouldPoll(record({ state: "failed" }))).toBe(false);
    expect(deploymentShouldPoll({ kind: "missing" })).toBe(false);
    expect(deploymentShouldPoll(undefined)).toBe(false);
  });
});

describe("deploymentCanDeploy (U8)", () => {
  it("offers Desplegar only for an approved review with no deployment recorded", () => {
    expect(deploymentCanDeploy("approved", { kind: "missing" })).toBe(true);
    expect(deploymentCanDeploy("approved", undefined)).toBe(false);
    expect(deploymentCanDeploy("approved", record({}))).toBe(false);
    for (const state of ["draft", "awaiting_assessment", "human_review", "changes_requested", "rejected"] as const) {
      expect(deploymentCanDeploy(state, { kind: "missing" })).toBe(false);
    }
  });

  it("keeps the missing copy honest about what Desplegar does", () => {
    expect(DEPLOYMENT_COPY.deploy).toBe("Desplegar");
    expect(DEPLOYMENT_COPY.deploying).toBe("Desplegando…");
    expect(DEPLOYMENT_COPY.missing).not.toMatch(/confirmada|fondos/i);
  });
});
