import { expect, test } from "./support/local-only";
import { STUB_API_BASE_URL } from "./support/targets";

/**
 * Issue-critical path 1: the guided demo shell. Covers the entry redirect, the
 * persistent environment chrome, and a real traversal across all six steps —
 * the behavior `apps/web`'s unit tests can only approximate with mocked routers.
 */
const STEPS = [
  { slug: "request", label: "Request" },
  { slug: "ai-assessment", label: "AI Assessment" },
  { slug: "approval", label: "Approval" },
  { slug: "funding", label: "Funding" },
  { slug: "distribution", label: "Distribution" },
  { slug: "evidence", label: "Evidence" }
] as const;

test.beforeEach(async ({ request }) => {
  // Keep each test independent of any request a previous test submitted.
  await request.post(`${STUB_API_BASE_URL}/__reset`);
});

test("the root redirects to the first demo step", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/request$/);
  await expect(page.getByRole("heading", { level: 1, name: "Request" })).toBeVisible();
});

test("the shell renders the demo chrome and the step progress", async ({ page }) => {
  await page.goto("/request");

  await expect(page.getByText("Vaqcrow")).toBeVisible();
  await expect(page.getByText("DEMO", { exact: true })).toBeVisible();
  await expect(page.getByText("TESTNET · Activos sin valor económico")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Demo progress" })).toContainText("Step 1 of 6: Request");
});

test("walks the six guided steps in order", async ({ page }) => {
  await page.goto("/request");

  for (const [index, step] of STEPS.entries()) {
    await expect(page).toHaveURL(new RegExp(`/${step.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: step.label })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Demo progress" })).toContainText(
      `Step ${index + 1} of 6: ${step.label}`
    );

    const next = STEPS[index + 1];
    if (next) {
      await page.getByRole("link", { name: next.label }).click();
    }
  }
});

test("submits the synthetic SME request to the local double and shows the backend evidence", async ({ page }) => {
  await page.goto("/request");

  // Before the double answers, the panel cites the synthetic fixture provenance.
  await expect(page.getByText("Declaración mensual sintética").first()).toBeVisible();

  await page.getByLabel("Total declarado (ARS)").fill("3150000");
  await page.getByLabel("Período desde").fill("2026-01");
  await page.getByLabel("Período hasta").fill("2026-03");
  await page.getByRole("button", { name: "Enviar solicitud" }).click();

  await expect(page.getByRole("status")).toContainText("Solicitud registrada en el entorno de demostración");
  // Backend provenance only exists once `GET /sme-requests/current` returned the double's data.
  const evidence = page.getByRole("region", { name: "Revisión de evidencia" });
  await expect(evidence.getByText("Registro del servicio de solicitudes").first()).toBeVisible();
  await expect(evidence.getByText("Abril 2026")).toBeVisible();
});
