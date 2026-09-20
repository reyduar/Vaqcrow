import { expect, test } from "./support/local-only";
import { DEMO_APPLICATION_ID, STUB_API_BASE_URL } from "./support/targets";

/**
 * Issue-critical path 2: the human approval step. The demo's core promise is that
 * a person decides and the backend confirms it — the AI only advises. These tests
 * exercise that boundary in a real browser against the local double.
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${STUB_API_BASE_URL}/__reset`);
});

test("never preselects a decision and keeps the AI recommendation advisory", async ({ page }) => {
  await page.goto("/approval");

  await expect(page.getByRole("heading", { name: "Recomendación de IA" })).toBeVisible();
  await expect(page.getByText("Solo asesora. No decide ni sustituye la decisión de la persona.")).toBeVisible();
  await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
});

test("refuses an incomplete decision locally and records nothing", async ({ page }) => {
  await page.goto("/approval");

  await page.getByRole("button", { name: "Registrar decisión" }).click();

  await expect(page.getByText("Elegí una decisión.")).toBeVisible();
  await expect(page.getByText("La razón es obligatoria.")).toBeVisible();
  await expect(page.getByText("Decisión humana registrada")).toHaveCount(0);
});

test("records an approved decision and renders only the backend record", async ({ page }) => {
  const reason = "Aprobado por el comité de crédito (demo).";

  await page.goto("/approval");
  await page.getByRole("radio", { name: "Aprobar" }).check();
  await page.getByLabel("Razón de la decisión").fill(reason);
  await page.getByLabel("Límite aprobado (ARS)").fill("5000000");
  await page.getByRole("button", { name: "Registrar decisión" }).click();

  const record = page.getByRole("region", { name: "Decisión registrada" });
  await expect(record.getByRole("status")).toContainText("Decisión humana registrada");
  await expect(record.getByText("Aprobada")).toBeVisible();
  await expect(record.getByText("operador-demo (simulado)")).toBeVisible();
  await expect(record.getByText(reason)).toBeVisible();
  // The limit is formatted from the backend value; the timestamp and correlation id
  // come from the server response, never from the browser clock.
  await expect(record.getByText(/5\.000\.000/)).toBeVisible();
  await expect(record.getByText("2026-09-19T12:00:00-03:00")).toBeVisible();
  await expect(record.getByText("11111111-2222-4333-8444-555555555555")).toBeVisible();
});

test("posts the decision to the demo application id only", async ({ page }) => {
  const decisionCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/decisions")) decisionCalls.push(request.url());
  });

  await page.goto("/approval");
  await page.getByRole("radio", { name: "Rechazar" }).check();
  await page.getByLabel("Razón de la decisión").fill("Fuera de política de riesgo (demo).");
  await page.getByRole("button", { name: "Registrar decisión" }).click();

  await expect(page.getByRole("region", { name: "Decisión registrada" })).toBeVisible();
  expect(decisionCalls).toHaveLength(1);
  expect(decisionCalls[0]).toBe(`${STUB_API_BASE_URL}/application-reviews/${DEMO_APPLICATION_ID}/decisions`);
});
