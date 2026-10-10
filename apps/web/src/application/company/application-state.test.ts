import { describe, expect, it } from "vitest";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import {
  APPLICATION_STATE_COPY,
  APPLICATION_STATE_SECTION_LABEL,
  applicationStateView
} from "./application-state";

describe("applicationStateView", () => {
  it("folds awaiting_assessment and human_review into the single «En revisión» state", () => {
    for (const state of ["awaiting_assessment", "human_review"] as const) {
      expect(applicationStateView(state)).toEqual({
        key: "awaiting_review",
        label: "En revisión",
        message: "Tu solicitud está en revisión. Todavía no está aprobada ni publicada.",
        tone: "caution",
        icon: "hourglass"
      });
    }
  });

  it("maps the decided states to their own label, tone and icon", () => {
    expect(applicationStateView("changes_requested")).toMatchObject({
      key: "changes_requested",
      label: "Requiere cambios",
      tone: "caution",
      icon: "create"
    });
    expect(applicationStateView("rejected")).toMatchObject({
      key: "rejected",
      label: "Rechazada",
      tone: "critical",
      icon: "close"
    });
    expect(applicationStateView("approved")).toMatchObject({
      key: "approved",
      label: "Aprobada",
      tone: "success",
      icon: "check"
    });
  });

  it("treats a null application as the pre-vault «Sin enviar» empty state", () => {
    expect(applicationStateView(null)).toEqual({
      key: "not_sent",
      label: "Sin enviar",
      message: "Todavía no enviaste tu solicitud a revisión. Cuando la envíes, acá vas a ver el estado.",
      tone: "info",
      icon: "document"
    });
  });

  it("never invents an in-review state for a draft that was never sent", () => {
    expect(applicationStateView("draft").key).toBe("not_sent");
  });

  it("covers every review state the contract exposes without falling through", () => {
    const states: readonly ApplicationReviewState[] = [
      "draft",
      "awaiting_assessment",
      "human_review",
      "approved",
      "changes_requested",
      "rejected"
    ];
    for (const state of states) {
      expect(applicationStateView(state).label.length).toBeGreaterThan(0);
    }
  });

  it("keeps the copy frozen and every display state present", () => {
    expect(Object.isFrozen(APPLICATION_STATE_COPY)).toBe(true);
    expect(Object.keys(APPLICATION_STATE_COPY).sort()).toEqual([
      "approved",
      "awaiting_review",
      "changes_requested",
      "not_sent",
      "rejected"
    ]);
    expect(APPLICATION_STATE_SECTION_LABEL).toBe("Estado de tu solicitud");
  });
});
