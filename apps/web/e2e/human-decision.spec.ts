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

test("never preselects a decision and keeps the persisted AI assessment advisory", async ({ page, request }) => {
  // The approval step shows what the backend persisted; seed an assessment for the demo application.
  await request.post(`${STUB_API_BASE_URL}/__seed-assessment`, { data: { applicationId: DEMO_APPLICATION_ID } });

  await page.goto(`/approval?application=${DEMO_APPLICATION_ID}`);

  await expect(page.getByRole("heading", { name: "Evaluación de IA", exact: true })).toBeVisible();
  await expect(page.getByText(/La IA solo asesora: no aprueba, no define límites y no transfiere fondos/)).toBeVisible();
  // Scoped to the decision form: the header's theme switcher is its own radio group
  // and always has a selection, which says nothing about the decision.
  const decision = page.getByRole("form", { name: "Decisión humana" });
  await expect(decision.locator('input[type="radio"]')).not.toHaveCount(0);
  await expect(decision.locator('input[type="radio"]:checked')).toHaveCount(0);
});

test("says no assessment was recorded, instead of showing a canned one, and still lets a person decide", async ({
  page
}) => {
  await page.goto(`/approval?application=${DEMO_APPLICATION_ID}`);

  await expect(page.getByRole("heading", { name: "Sin evaluación de IA", exact: true })).toBeVisible();
  await expect(page.getByText("Todavía no hay ninguna evaluación de IA registrada para esta solicitud.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evaluación de IA", exact: true })).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Decisión humana" })).toBeVisible();
});

test("refuses an incomplete decision locally and records nothing", async ({ page }) => {
  await page.goto(`/approval?application=${DEMO_APPLICATION_ID}`);

  await page.getByRole("button", { name: "Registrar decisión" }).click();

  await expect(page.getByText("Elegí una decisión.")).toBeVisible();
  await expect(page.getByText("La razón es obligatoria.")).toBeVisible();
  await expect(page.getByText("Decisión humana registrada")).toHaveCount(0);
});

test("records an approved decision and renders only the backend record", async ({ page }) => {
  const reason = "Aprobado por el comité de crédito (demo).";

  await page.goto(`/approval?application=${DEMO_APPLICATION_ID}`);
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

  await page.goto(`/approval?application=${DEMO_APPLICATION_ID}`);
  await page.getByRole("radio", { name: "Rechazar" }).check();
  await page.getByLabel("Razón de la decisión").fill("Fuera de política de riesgo (demo).");
  await page.getByRole("button", { name: "Registrar decisión" }).click();

  await expect(page.getByRole("region", { name: "Decisión registrada" })).toBeVisible();
  expect(decisionCalls).toHaveLength(1);
  expect(decisionCalls[0]).toBe(`${STUB_API_BASE_URL}/application-reviews/${DEMO_APPLICATION_ID}/decisions`);
});
