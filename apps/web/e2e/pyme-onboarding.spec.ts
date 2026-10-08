import type { Page } from "@playwright/test";
import { expect, test } from "./support/local-only";
import { installFreighterEmulator, setFreighterScenario } from "./support/freighter-emulator";
import { STUB_API_BASE_URL, STUB_SUPABASE_URL } from "./support/targets";

/**
 * Issue #400 — the PyME onboarding wizard end to end in a real browser.
 *
 * The jsdom suite (`pyme-onboarding-wizard.test.tsx`) already drives every step
 * against in-process doubles; this is the one smoke that walks the whole wizard
 * with the app's production wiring: real `/company` route gating (stub Supabase
 * Auth), the API-mediated upload, the company ensure-then-create, the SME
 * request and the Freighter wallet, all against the local doubles. Nothing
 * leaves the machine — `./support/local-only` fails the test if the browser
 * reaches any host beyond the app and the stubs.
 *
 * Literals are duplicated from the doubles on purpose (`e2e/` does not import
 * from `src/`, and the stub stays the source of truth).
 */

const PASSWORD = "secret-123";
const PYME = {
  name: "Panadería Horizonte SRL",
  email: "panaderia.onboarding.e2e@example.test"
} as const;

/** The connected Freighter account: a syntactically valid Testnet-style public key. */
const PYME_PUBLIC_KEY = `G${"B".repeat(55)}`;
const STUB_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

/** The reference the demo CUIT produces (`smeReferenceFor`): the request records it. */
const DEMO_SME_REFERENCE = "30712345678";
/** The fixed application id the stub assigns to every `POST /sme-requests`. */
const STUB_APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

const REQUIRED_DOCUMENTS = ["Declaraciones de ventas", "Constancia de CUIT", "Estatuto"] as const;

/** Creates a confirmed PYME through the stub Auth double and signs it in. */
async function signInAsPyme(page: Page): Promise<void> {
  await page.goto("/signup?role=pyme");
  await expect(page.getByRole("heading", { level: 2, name: "Creá tu cuenta" })).toBeVisible();
  await page.getByLabel("Nombre o Razón Social").fill(PYME.name);
  await page.getByLabel("Correo electrónico").fill(PYME.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();

  // Reaching the created view means the account exists; confirm through the
  // double's control endpoint (the email link a real project would send).
  await expect(page.getByRole("heading", { level: 2, name: "Registrá tu PyME" })).toBeVisible();
  const confirmed = await page.request.post(`${STUB_SUPABASE_URL}/__confirm`, { data: { email: PYME.email } });
  expect(confirmed.ok()).toBe(true);

  await page.goto("/login?role=pyme");
  await page.getByLabel("Correo electrónico").fill(PYME.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/company$/);
}

/** Selects a small synthetic PDF for each of the three mandatory slots and waits for the upload. */
async function uploadRequiredDocuments(page: Page): Promise<void> {
  for (const title of REQUIRED_DOCUMENTS) {
    const fileName = `${title.replace(/\s+/g, "-").toLowerCase()}.pdf`;
    await page.getByLabel(title).setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 documento sintetico de demo")
    });
    // The slot renders the stored name only once `POST /storage/uploads` resolves.
    await expect(page.getByText(fileName)).toBeVisible();
  }
}

test.beforeEach(async ({ request, page }) => {
  await request.post(`${STUB_API_BASE_URL}/__reset`);
  await request.post(`${STUB_SUPABASE_URL}/__reset`);
  // The listener must exist before the first navigation; the scenario is set later.
  await installFreighterEmulator(page);
});

test.describe("PyME onboarding wizard", () => {
  test("walks KYC, registration, documents, AI and review, and submits the request", async ({ page }) => {
    await signInAsPyme(page);

    await page.getByRole("button", { name: "Registrar mi PyME" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Verificación de identidad" })).toBeVisible();

    // Step 1 — KYC (client-side simulated): verify "Persona A" and advance.
    await page.getByRole("button", { name: "Iniciar verificación simulada" }).click();
    await expect(page.getByText("KYC aprobado · SIMULADO")).toBeVisible();
    await page.getByRole("button", { name: "Siguiente paso" }).click();

    // Step 2 — registration: demo values, the three mandatory documents, submit.
    await expect(page.getByRole("heading", { level: 1, name: "Registrá tu PyME" })).toBeVisible();
    await page.getByRole("button", { name: "Completar con datos de ejemplo" }).click();
    // #410/U13: the demo helper picks 60 días; the PyME changes it to 90.
    const duration = page.getByLabel("Plazo de la campaña");
    await expect(duration).toHaveValue("60");
    await duration.selectOption({ label: "90 días" });
    await uploadRequiredDocuments(page);
    await page.getByRole("button", { name: "Enviar a evaluación AI" }).click();

    // Step 3 — AI (client-side simulated): the four checks settle, then continue.
    await expect(page.getByRole("heading", { level: 1, name: "Evaluación AI" })).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();

    // Step 4 — review: the wallet is mandatory, so the first send is gated.
    await expect(page.getByRole("heading", { level: 1, name: "Qué pasa ahora" })).toBeVisible();
    await expect(page.getByRole("definition")).toContainText("90 días");
    await setFreighterScenario(page, {
      installed: true,
      publicKey: PYME_PUBLIC_KEY,
      networkPassphrase: STUB_NETWORK_PASSPHRASE,
      network: "TESTNET"
    });
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page.getByText("Conectá tu wallet Freighter para poder enviar la solicitud a revisión.")).toBeVisible();
    await page.getByRole("button", { name: "Conectar Freighter" }).click();
    await expect(page.getByText(/Wallet Freighter conectada/)).toBeVisible();

    // The second send persists the company (ensure-then-create) and submits.
    await page.getByRole("button", { name: "Enviar a revisión" }).click();

    await expect(page.getByText("Solicitud enviada a revisión. Te avisamos cuando haya una decisión.")).toBeVisible();
    const stepper = page.getByRole("list", { name: "Pasos del registro" });
    await expect(stepper.locator('li[aria-current="step"]')).toContainText("Revisión humana");
    await expect(
      page.getByRole("region", { name: "Revisión humana" }).getByText("En proceso", { exact: true })
    ).toBeVisible();

    // The stub recorded the submitted request with the demo CUIT reference.
    const recorded = await page.request.get(`${STUB_API_BASE_URL}/sme-requests/${STUB_APPLICATION_ID}`);
    expect(recorded.ok()).toBe(true);
    const body: unknown = await recorded.json();
    expect(body).toMatchObject({ request: { smeReference: DEMO_SME_REFERENCE } });

    // The company was persisted with the chosen duration in whole days.
    const company = await page.request.get(`${STUB_API_BASE_URL}/businesses/mine`);
    expect(company.ok()).toBe(true);
    expect(await company.json()).toMatchObject({ business: { campaignDurationDays: 90 } });
  });
});
