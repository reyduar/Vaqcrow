import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminEvidencePage from "./(console)/pymes/[applicationId]/evidence/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/pymes"
}));

const APPLICATION_ID = "22222222-2222-4222-8222-222222222222";

describe("/admin/pymes/[applicationId]/evidence", () => {
  it("renders the evidence view for the route's application id", async () => {
    // Without NEXT_PUBLIC_API_BASE_URL the browser port is the null object, so
    // the view shows the honest "no backend configured" notice (#480), not an error.
    const page = await AdminEvidencePage({ params: Promise.resolve({ applicationId: APPLICATION_ID }) });
    render(page);
    expect(await screen.findByText("Esta instancia no tiene configurada la API")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("navigation", { name: "Ruta" }).querySelector(`a[href="/admin/pymes/${APPLICATION_ID}"]`)
    ).toBeTruthy();
  });
});
