import { describe, expect, it } from "vitest";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import { canRegisterCompany } from "./can-register-company";

/**
 * The button's visibility rule (Feature #530, S1/S2/S3): «Registrar mi PyME» is
 * only for «Sin enviar» — no application, an unknown read, or a `draft`. Every
 * real post-submission state hides it. Pure, so it is asserted without React.
 */
describe("canRegisterCompany", () => {
  it("offers the button when the state was not read (unknown, never a service failure)", () => {
    expect(canRegisterCompany(undefined)).toBe(true);
  });

  it("offers the button when the PyME owns no application (Sin enviar)", () => {
    expect(canRegisterCompany(null)).toBe(true);
  });

  it("offers the button while the application is still a draft (Sin enviar)", () => {
    expect(canRegisterCompany("draft")).toBe(true);
  });

  it("hides the button while the application is in review (S1)", () => {
    expect(canRegisterCompany("awaiting_assessment")).toBe(false);
    expect(canRegisterCompany("human_review")).toBe(false);
  });

  it("hides the button once the campaign is approved (S2)", () => {
    expect(canRegisterCompany("approved")).toBe(false);
  });

  it("hides the button for changes_requested and rejected (S3)", () => {
    expect(canRegisterCompany("changes_requested")).toBe(false);
    expect(canRegisterCompany("rejected")).toBe(false);
  });

  it("covers every review state the contract defines", () => {
    const states: readonly ApplicationReviewState[] = [
      "draft",
      "awaiting_assessment",
      "human_review",
      "approved",
      "changes_requested",
      "rejected"
    ];
    expect(states.filter(canRegisterCompany)).toEqual(["draft"]);
  });
});
