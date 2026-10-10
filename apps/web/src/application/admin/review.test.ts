import { describe, expect, it } from "vitest";
import type { AdminReviewCompany } from "@/application/ports/admin-review-port";
import { adminReviewPath, reviewHeaderFor } from "./review";

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";

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

describe("adminReviewPath", () => {
  it("builds the English console route for one application", () => {
    expect(adminReviewPath(APPLICATION_ID)).toBe(`/admin/pymes/${APPLICATION_ID}`);
  });

  it("encodes anything that is not a plain path segment", () => {
    expect(adminReviewPath("a/b c")).toBe("/admin/pymes/a%2Fb%20c");
  });
});

describe("reviewHeaderFor", () => {
  it("titles the review with the company and joins sector and id", () => {
    expect(reviewHeaderFor({ applicationId: APPLICATION_ID, state: "human_review", company: COMPANY })).toEqual({
      title: "Revisión: Panadería Horizonte SRL",
      subline: `Alimentos · ${APPLICATION_ID}`,
      state: { label: "Pendiente de revisión", tone: "caution", icon: "hourglass" }
    });
  });

  it("renders the honest 'Sin dato' when the application has no company", () => {
    const header = reviewHeaderFor({ applicationId: APPLICATION_ID, state: "changes_requested", company: null });
    expect(header.title).toBe("Revisión: Sin dato");
    expect(header.subline).toBe(`Sin dato · ${APPLICATION_ID}`);
    expect(header.state.label).toBe("Requiere cambios");
  });

  it("treats a blank name or sector as missing", () => {
    const header = reviewHeaderFor({
      applicationId: APPLICATION_ID,
      state: "approved",
      company: { ...COMPANY, name: "  ", sector: "" }
    });
    expect(header.title).toBe("Revisión: Sin dato");
    expect(header.subline).toBe(`Sin dato · ${APPLICATION_ID}`);
    expect(header.state.label).toBe("Aprobada");
  });

  it("appends the submission date only when one is known", () => {
    const header = reviewHeaderFor({
      applicationId: APPLICATION_ID,
      state: "rejected",
      company: COMPANY,
      submittedAt: "2026-09-11T12:00:00.000Z"
    });
    expect(header.subline).toBe(`Alimentos · ${APPLICATION_ID} · enviada el 11/09/2026`);
    expect(header.state.label).toBe("Rechazada");
  });
});
