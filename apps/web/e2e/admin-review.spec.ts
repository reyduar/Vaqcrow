import type { Page } from "@playwright/test";
import { expect, test } from "./support/local-only";
import { STUB_API_BASE_URL, STUB_SUPABASE_URL } from "./support/targets";

/**
 * Feature #410 (UI phase, U7): the admin reviews one application end to end in
 * a real browser — queue, review header and sections 1–3, a document verdict,
 * the private document viewer, the confirmed human decision and the vault
 * deployment panel (D3) — against the local doubles only
 * (`support/stub-admin-review-routes.mjs`, `support/stub-supabase-server.mjs`).
 * Nothing here reaches Supabase, Stellar Testnet or an LLM provider.
 *
 * The ids and the admin's display name are duplicated literally from the stub
 * module on purpose: `e2e/` specs never import `.mjs` doubles without a typed
 * declaration, and these are fixture values, not a shared contract.
 */
const REVIEW_APPLICATION_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ADMIN = { email: "admin.e2e@example.test", password: "secret-admin-123", displayName: "Admin Vaqcrow" };
const REVIEW_PATH = `/admin/pymes/${REVIEW_APPLICATION_ID}`;

test.beforeEach(async ({ request }) => {
  await request.post(`${STUB_API_BASE_URL}/__reset`);
  await request.post(`${STUB_SUPABASE_URL}/__reset`);
  const seeded = await request.post(`${STUB_SUPABASE_URL}/__seed-admin`, { data: ADMIN });
  expect(seeded.ok()).toBe(true);
});

async function signInAsAdmin(page: Page) {
  await page.goto("/admin");
  const form = page.getByRole("form", { name: "Ingreso de administrador" });
  await form.getByLabel("Correo").fill(ADMIN.email);
  await form.getByLabel("Contraseña").fill(ADMIN.password);
  await form.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/admin\/pymes$/);
  await expect(page.getByRole("heading", { level: 1, name: "PyMEs" })).toBeVisible();
}

test("an admin opens an application from the queue, reviews it, approves it and sees the vault deployment", async ({
  page
}) => {
  const decisionBodies: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith(`/application-reviews/${REVIEW_APPLICATION_ID}/decisions`)) {
      decisionBodies.push(request.postDataJSON());
    }
  });

  await signInAsAdmin(page);

  // Queue → review.
  const row = page.getByRole("row", { name: /Panadería Horizonte SRL/ });
  await expect(row).toContainText("Pendiente de revisión");
  await row.getByRole("link", { name: "Revisar solicitud" }).click();
  await expect(page).toHaveURL(new RegExp(`${REVIEW_PATH}$`));

  // Header and the three sections.
  await expect(page.getByRole("heading", { level: 1, name: "Revisión: Panadería Horizonte SRL" })).toBeVisible();
  await expect(page.getByText(`Gastronomía · ${REVIEW_APPLICATION_ID}`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "1 · KYC/KYB" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "2 · Recomendación de IA" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "3 · Decisión humana" })).toBeVisible();
  // No vault panel before an approval.
  await expect(page.getByRole("heading", { level: 2, name: "Despliegue de la bóveda" })).toHaveCount(0);

  // Section 1: a persisted per-document verdict.
  const cuitVerdicts = page.getByRole("group", { name: "Estado de Constancia de CUIT" });
  const valid = cuitVerdicts.getByRole("button", { name: "Válido", exact: true });
  await expect(valid).toHaveAttribute("aria-pressed", "false");
  await valid.click();
  await expect(valid).toHaveAttribute("aria-pressed", "true");
  await expect(cuitVerdicts.getByRole("button", { name: "Pedir" })).toHaveAttribute("aria-pressed", "false");

  // Section 1: the private viewer reads the bytes through the authenticated API
  // and opens them in a new tab as a `blob:` URL, never a public storage link.
  const storageRead = page.waitForRequest(
    (request) => request.method() === "GET" && request.url().startsWith(`${STUB_API_BASE_URL}/storage/uploads?path=`)
  );
  const popupOpened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Abrir Foto 1" }).click();
  const read = await storageRead;
  expect(new URL(read.url()).searchParams.get("path")).toMatch(/\/photo\/local\.png$/);
  expect(read.headers()["authorization"]).toMatch(/^Bearer \S+$/);
  const popup = await popupOpened;
  await popup.waitForURL(/^blob:/);
  await popup.close();

  // Section 3: approval with a read-only limit equal to the PyME's declared goal (D7).
  const limit = page.getByLabel("Límite aprobado (ARS)");
  await expect(limit).toHaveValue("12.000.000");
  await expect(limit).toHaveAttribute("readonly", "");
  // The radio is visually hidden inside its option card: the person clicks the card.
  await page.locator("label").filter({ hasText: "Aprobar con límite" }).click();
  await expect(page.getByRole("radio", { name: "Aprobar con límite" })).toBeChecked();

  // A reason under 10 characters is refused locally, before any confirmation.
  await page.getByLabel("Razón").fill("Corta");
  await page.getByRole("button", { name: "Registrar decisión" }).click();
  await expect(page.getByText("La razón debe tener al menos 10 caracteres.")).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  const reason = "Ventas consistentes y documentación válida (e2e).";
  await page.getByLabel("Razón").fill(reason);
  await page.getByRole("button", { name: "Registrar decisión" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(
    "Aprobada con límite ARS 12.000.000. Queda atribuida a Admin Vaqcrow y visible para la PyME y los aportantes."
  );
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(dialog).toHaveCount(0);

  // The server's record, read-only: the actor comes from the server, never from the form.
  await expect(page.getByRole("status").filter({ hasText: /^Registrada por Admin Vaqcrow · .+ · Aprobada$/ })).toBeVisible();
  await expect(page.getByText(reason)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Aprobar con límite" })).toHaveCount(0);

  // Exactly the four contract keys travelled; no `actor`.
  expect(decisionBodies).toHaveLength(1);
  const body = decisionBodies[0] as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(["approvedLimitArs", "decisionId", "outcome", "reason"]);
  expect(body).toMatchObject({ outcome: "approved", reason, approvedLimitArs: 12000000 });

  // Verdicts are read-only once decided.
  await expect(cuitVerdicts.getByRole("button", { name: "Válido", exact: true })).toBeDisabled();

  // Deployment panel (D3): the double scripts a failed first attempt, then Reintentar confirms.
  await expect(page.getByRole("heading", { level: 2, name: "Despliegue de la bóveda" })).toBeVisible();
  await expect(page.getByText("Despliegue fallido", { exact: true })).toBeVisible();
  await expect(page.getByText(/^La bóveda no quedó confirmada\. No había una tasa ARS\/USD vigente/)).toBeVisible();
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByText("Bóveda confirmada / PyME publicada", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver detalle" }).click();
  await expect(page.getByText("50000000-0000-4000-8000-000000000000")).toBeVisible();
});

test("a decision recorded elsewhere while the form is open is refused with 409 and nothing is claimed", async ({
  page,
  request
}) => {
  await signInAsAdmin(page);
  await page.goto(REVIEW_PATH);
  await expect(page.getByRole("heading", { level: 2, name: "3 · Decisión humana" })).toBeVisible();

  // The radio is visually hidden inside its option card: the person clicks the card.
  await page.locator("label").filter({ hasText: "Rechazar" }).click();
  await expect(page.getByRole("radio", { name: "Rechazar" })).toBeChecked();
  await page.getByLabel("Razón").fill("Fuera de política de riesgo (e2e).");

  // Another admin decides first.
  await request.post(`${STUB_API_BASE_URL}/__admin-review/decide-elsewhere`, { data: { outcome: "rejected" } });

  await page.getByRole("button", { name: "Registrar decisión" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Esta solicitud ya tiene una decisión registrada. No se registró tu decisión." })
  ).toBeVisible();
  // The view reloads into the server's record, attributed to who actually decided.
  await expect(page.getByRole("status").filter({ hasText: /^Registrada por Admin Vaqcrow · .+ · Rechazada$/ })).toBeVisible();
  await expect(page.getByText("Decisión registrada antes de abrir la revisión (e2e).")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Despliegue de la bóveda" })).toHaveCount(0);
});

test("an already-approved application opens read-only with its deployment state", async ({ page, request }) => {
  await request.post(`${STUB_API_BASE_URL}/__admin-review/seed`, { data: { state: "approved" } });
  await signInAsAdmin(page);

  const row = page.getByRole("row", { name: /Panadería Horizonte SRL/ });
  await expect(row).toContainText("Aprobada");
  await row.getByRole("link", { name: "Ver detalle" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Revisión: Panadería Horizonte SRL" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^Registrada por Admin Vaqcrow · .+ · Aprobada$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar decisión" })).toHaveCount(0);
  for (const label of ["Válido", "Pedir", "Inválido"]) {
    await expect(
      page.getByRole("group", { name: "Estado de Constancia de CUIT" }).getByRole("button", { name: label, exact: true })
    ).toBeDisabled();
  }
  await expect(page.getByText("Despliegue fallido", { exact: true })).toBeVisible();
});

test("an approval with no recorded deployment offers Desplegar, which confirms the vault (U8)", async ({ page, request }) => {
  await request.post(`${STUB_API_BASE_URL}/__admin-review/seed`, { data: { state: "approved", deployment: "none" } });
  await signInAsAdmin(page);
  await page.goto(REVIEW_PATH);

  await expect(page.getByRole("heading", { level: 2, name: "Despliegue de la bóveda" })).toBeVisible();
  await expect(page.getByText(/^Todavía no hay un despliegue registrado/)).toBeVisible();
  await page.getByRole("button", { name: "Desplegar" }).click();
  await expect(page.getByText("Bóveda confirmada / PyME publicada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Desplegar" })).toHaveCount(0);
});

test("an admin opens the Testnet evidence chain from the queue and from the review (#438)", async ({ page, request }) => {
  await request.post(`${STUB_API_BASE_URL}/__admin-review/seed`, { data: { state: "approved" } });
  await signInAsAdmin(page);

  const row = page.getByRole("row", { name: /Panadería Horizonte SRL/ });
  await row.getByRole("link", { name: "Evidencia de Panadería Horizonte SRL" }).click();
  // `next dev` compiles the evidence route on its first visit; a cold run needs more than the default wait.
  await expect(page).toHaveURL(new RegExp(`${REVIEW_PATH}/evidence$`), { timeout: 30_000 });

  await expect(page.getByRole("heading", { level: 1, name: "Evidencia: Panadería Horizonte SRL" })).toBeVisible();
  const chain = page.getByRole("list", { name: "Cadena de evidencia" });
  await expect(chain.getByRole("heading", { level: 2 })).toHaveText([
    "1 · Solicitud",
    "2 · Decisión humana",
    "3 · Despliegue de la bóveda",
    "4 · Aportes",
    "5 · Distribuciones",
    "6 · Reconciliación"
  ]);
  await expect(chain.getByText("Admin Vaqcrow", { exact: true })).toBeVisible();
  await expect(chain.getByText("Despliegue fallido", { exact: true })).toBeVisible();
  await expect(chain.getByText("Todavía no hay aportes confirmados")).toBeVisible();

  await page.getByRole("navigation", { name: "Ruta" }).getByRole("link", { name: "Revisión" }).click();
  await expect(page).toHaveURL(new RegExp(`${REVIEW_PATH}$`));
  await page.getByRole("link", { name: "Ver evidencia Testnet" }).click();
  await expect(page).toHaveURL(new RegExp(`${REVIEW_PATH}/evidence$`));
});
