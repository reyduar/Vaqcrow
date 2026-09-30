import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect, test } from "./support/local-only";
import { installFreighterEmulator, setFreighterScenario } from "./support/freighter-emulator";
import { STUB_API_BASE_URL } from "./support/targets";

/**
 * Task #96 — one deterministic browser walk across the whole vertical demo
 * journey: request -> AI assessment -> human approval -> vault funding and
 * contribution -> recorded monthly sales period -> deterministic distribution
 * -> evidence. The other specs under `e2e/` cover each step in isolation and
 * `guided-journey.spec.ts` covers the request/assessment/approval half; this
 * spec is the only one that asserts the identifiers produced by one step are
 * the ones the next step consumes, all the way to the evidence.
 *
 * Everything stays local: the app talks to `support/stub-api-server.mjs` and the
 * wallet is `support/freighter-emulator.ts`. `./support/local-only` fails the
 * test if the browser reaches any host beyond the app and the stub.
 *
 * Ids, account keys and fixture amounts below are duplicated literally from the
 * stub modules (`support/stub-api-server.mjs`, `support/stub-campaign-routes.mjs`,
 * `support/stub-distribution-routes.mjs`), the same "e2e/ must not import from
 * src/, and the stub stays the source of truth" convention `targets.ts`
 * documents.
 */

const SME_ACCOUNT_OK = `G${"A".repeat(55)}`;
const INVESTOR_ACCOUNT_OK = `G${"C".repeat(55)}`;
const STUB_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

/** The reference the demo request carries; the sales feed resolves it to `panaderia-horizonte`. */
const DEMO_SME_REFERENCE = "sme:SYN-PH-0001";

/** Fixed ids the stub returns; the walk asserts each is the one the next step consumes. */
const REQUEST_APPLICATION_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";
const OPENED_CAMPAIGN_ID = "20000000-0000-4000-8000-000000000000";
const OPENED_CONTRACT = `C${"N".repeat(55)}`;
const DISTRIBUTION_ID = "60000000-0000-4000-8000-000000000000";
const DISTRIBUTION_TX_HASH = "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";

/** The preseeded funding fixture: still funding, for the preseeded demo application. */
const DEMO_APPLICATION_ID = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const FUNDING_CAMPAIGN_ID = "40000000-0000-4000-8000-000000000000";

/** The recorded feed period (the stub's `NEXT_SALES_PERIOD`): 3,860,000 ARS at 450 bps is 173,700 ARS. */
const RECORDED_PERIOD = "2026-09";
const RECORDED_SALES_ARSS = "3.860.000";
const RECORDED_OBLIGATION_ARS = "173.700";
const RECORDED_OBLIGATION_XLM = "0.6948";

const APPROVAL_REASON = "Aprobado por el comité de crédito (demo).";

/**
 * Same `<dl>` scoping rationale as `campaign-vault.spec.ts` and
 * `evidence-dashboard.spec.ts`: a row's value can repeat elsewhere on the page,
 * so every amount is read from its own `<dt>` label instead of a bare
 * `getByText` that could match more than one element.
 */
function factValue(entry: Locator, label: string) {
  return entry.getByText(label, { exact: true }).locator("xpath=following-sibling::dd[1]");
}

/** The timeline is a flat `<ol>` of `<li>` entries, scoped by each entry's own `<h3>` title. */
function entryFor(page: Page, title: string) {
  return page.locator("li").filter({ has: page.getByRole("heading", { name: title, level: 3 }) });
}

/** The campaign view's `<dl>` rows, read from the row's own `<dt>` label (same rationale as `campaign-vault.spec.ts`). */
function ddValueFor(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator("xpath=following-sibling::dd[1]");
}

const stepNav = (page: Page) => page.getByRole("navigation", { name: "Demo step navigation" });

/** The journey identifiers the URL currently carries, exactly as `journey-params.ts` names them. */
function journeyParam(page: Page, name: "application" | "campaign" | "distribution"): string | null {
  return new URL(page.url()).searchParams.get(name);
}

async function connectAs(page: Page, publicKey: string) {
  await setFreighterScenario(page, {
    installed: true,
    publicKey,
    networkPassphrase: STUB_NETWORK_PASSPHRASE,
    network: "LOCAL"
  });
  await page.getByRole("button", { name: "Conectar wallet" }).click();
  await expect(page.getByText(`Wallet conectada: ${publicKey}`)).toBeVisible();
}

/**
 * Records the feed's next period (2026-09) against the reference the demo
 * request carries — the operator runbook's own step (`docs/planning/demo-run-preflight.md`),
 * and the datum the distribution derives its obligation from. The browser has
 * no sales-feed control, so this is the same API call the operator makes.
 */
async function recordNextSalesPeriod(request: APIRequestContext) {
  const response = await request.post(
    `${STUB_API_BASE_URL}/businesses/${encodeURIComponent(DEMO_SME_REFERENCE)}/sales-periods`,
    { data: {} }
  );
  expect(response.status()).toBe(201);
  const body: unknown = await response.json();
  expect(body).toMatchObject({
    applied: true,
    period: { period: RECORDED_PERIOD, amountArs: 3_860_000, status: "reported" }
  });
}

/** Funds the stub's 20 XLM preseeded funding fixture as the investor, so it settles. */
async function settleFundingCampaignAsInvestor(page: Page) {
  await page.goto(`/funding?application=${DEMO_APPLICATION_ID}&campaign=${FUNDING_CAMPAIGN_ID}`);
  await connectAs(page, INVESTOR_ACCOUNT_OK);
  await page.getByLabel("Monto a aportar (XLM)").fill("20");
  await page.getByRole("button", { name: "Aportar" }).click();
  await page.getByRole("button", { name: "Firmar en Freighter" }).click();
  await expect(page.getByText("Meta alcanzada")).toBeVisible();
}

/** Signs the server-derived distribution for the preseeded funding campaign as its own SME. */
async function distributeAsSme(page: Page) {
  await page.goto(`/distribution?application=${DEMO_APPLICATION_ID}&campaign=${FUNDING_CAMPAIGN_ID}`);
  await connectAs(page, SME_ACCOUNT_OK);
  await page.getByRole("button", { name: "Preparar distribución" }).click();
  const review = page.getByRole("dialog");
  await expect(review).toBeVisible();
  await review.getByText("Confirmo que revisé los destinatarios y los montos").click();
  await review.getByRole("button", { name: "Firmar en Freighter" }).click();
  await expect(page.getByText("Enviada · pendiente de confirmación")).toBeVisible();
}

test.beforeEach(async ({ request, page }) => {
  // Keep every test independent of any request, distribution or sales period a previous test produced.
  await request.post(`${STUB_API_BASE_URL}/__reset`);
  await installFreighterEmulator(page);
});

test("walks the request, assessment, approval, funding, sales record, distribution and evidence in one pass", async ({
  page,
  request
}) => {
  // 1. Request: the journey starts with the synthetic SME request.
  await page.goto("/request");
  await page.getByLabel("Total declarado (ARS)").fill("3150000");
  await page.getByLabel("Período desde").fill("2026-01");
  await page.getByLabel("Período hasta").fill("2026-03");
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByRole("status")).toContainText("Solicitud registrada en el entorno de demostración");
  await expect(page).toHaveURL(new RegExp(`/request\\?application=${REQUEST_APPLICATION_ID}$`));
  expect(journeyParam(page, "application")).toBe(REQUEST_APPLICATION_ID);

  // 2. AI assessment: it consumes the request's applicationId and records the advisory assessment.
  await stepNav(page).getByRole("link", { name: "AI Assessment" }).click();
  await expect(page).toHaveURL(new RegExp(`/ai-assessment\\?application=${REQUEST_APPLICATION_ID}$`));
  await page.getByRole("button", { name: "Consultar evaluación de IA" }).click();
  await expect(page.getByRole("region", { name: "Evaluación de IA" })).toContainText("asm_stub_001");
  await expect(page.getByRole("status").filter({ hasText: "pasó a revisión humana" })).toBeVisible();

  // 3. Approval: the same application carries the persisted assessment into the human decision.
  await stepNav(page).getByRole("link", { name: "Approval" }).click();
  await expect(page).toHaveURL(new RegExp(`/approval\\?application=${REQUEST_APPLICATION_ID}$`));
  await expect(page.getByRole("region", { name: "Evaluación de IA" })).toContainText("asm_stub_001");
  await page.getByRole("radio", { name: "Aprobar" }).check();
  await page.getByLabel("Razón de la decisión").fill(APPROVAL_REASON);
  await page.getByLabel("Límite aprobado (ARS)").fill("5000000");
  await page.getByRole("button", { name: "Registrar decisión" }).click();
  await expect(
    page.getByRole("region", { name: "Decisión registrada" }).getByRole("status")
  ).toContainText("Decisión humana registrada");

  // 4. Funding: the SME opens the vault for the same application; the app records the campaign id.
  await stepNav(page).getByRole("link", { name: "Funding" }).click();
  await expect(page).toHaveURL(new RegExp(`/funding\\?application=${REQUEST_APPLICATION_ID}$`));
  await connectAs(page, SME_ACCOUNT_OK);
  await page.getByLabel("Meta (XLM)").fill("20");
  await page.getByLabel("Fecha límite").fill("2030-01-01");
  await page.getByRole("button", { name: "Abrir bóveda" }).click();
  await expect(page).toHaveURL(new RegExp(`campaign=${OPENED_CAMPAIGN_ID}`));
  expect(journeyParam(page, "application")).toBe(REQUEST_APPLICATION_ID);
  await expect(page.getByRole("heading", { name: "Bóveda de campaña" })).toBeVisible();
  await expect(page.getByText("Fondeo abierto")).toBeVisible();

  // 5. Contribution: a different wallet funds the vault to its goal, which settles it.
  //    The emulator is switched and the page remounted, because a connected wallet
  //    has no in-page "disconnect".
  await setFreighterScenario(page, {
    installed: true,
    publicKey: INVESTOR_ACCOUNT_OK,
    networkPassphrase: STUB_NETWORK_PASSPHRASE,
    network: "LOCAL"
  });
  await page.reload();
  await connectAs(page, INVESTOR_ACCOUNT_OK);
  await page.getByLabel("Monto a aportar (XLM)").fill("20");
  await page.getByRole("button", { name: "Aportar" }).click();
  await page.getByRole("button", { name: "Firmar en Freighter" }).click();
  await expect(page.getByText("Meta alcanzada")).toBeVisible();
  await expect(ddValueFor(page, "Total aportado")).toHaveText("20 XLM");

  // 6. Monthly sales: the feed records its next period (2026-09) for the request's own
  //    SME reference — the operator runbook's own step, and the datum the distribution
  //    derives its obligation from.
  await recordNextSalesPeriod(request);

  // 7. Distribution: the SME signs the server-derived distribution for the journey's
  //    campaign; the derivation's period is the one the feed just recorded.
  await stepNav(page).getByRole("link", { name: "Distribution" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/distribution\\?application=${REQUEST_APPLICATION_ID}&campaign=${OPENED_CAMPAIGN_ID}$`)
  );
  await connectAs(page, SME_ACCOUNT_OK);
  await page.getByRole("button", { name: "Preparar distribución" }).click();
  const review = page.getByRole("dialog");
  await expect(review).toBeVisible();
  await expect(review).toContainText(RECORDED_PERIOD);
  await expect(review).toContainText(`ARS ${RECORDED_SALES_ARSS}`);
  await expect(review).toContainText("4,50 %");
  await expect(review).toContainText(`ARS ${RECORDED_OBLIGATION_ARS}`);
  await expect(review).toContainText(`${RECORDED_OBLIGATION_XLM} XLM`);
  await review.getByText("Confirmo que revisé los destinatarios y los montos").click();
  await review.getByRole("button", { name: "Firmar en Freighter" }).click();
  await expect(page.getByText("Enviada · pendiente de confirmación")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`distribution=${DISTRIBUTION_ID}`));

  // 8. Evidence: the recap reads back the decision, the campaign and the distribution
  //    by the ids the journey produced, and names the request it all belongs to.
  await stepNav(page).getByRole("link", { name: "Evidence" }).click();
  await expect(page).toHaveURL(/\/evidence\?/);
  const timeline = page.getByRole("region", { name: "Evidencia de la ejecución" });
  await expect(timeline).toBeVisible();

  const synthetic = entryFor(page, "Caso simulado");
  await expect(factValue(synthetic, "Solicitud")).toHaveText(REQUEST_APPLICATION_ID);

  const decision = entryFor(page, "Decisión humana");
  await expect(decision).toContainText("Estado: Observado");
  await expect(factValue(decision, "Decisión")).toHaveText("Aprobada");
  await expect(factValue(decision, "Razón")).toHaveText(APPROVAL_REASON);

  const vault = entryFor(page, "Bóveda de campaña");
  await expect(vault).toContainText("Estado: Observado");
  await expect(factValue(vault, "Estado")).toHaveText("Meta alcanzada");
  await expect(factValue(vault, "Total aportado")).toHaveText("20 XLM");
  await expect(vault.getByTitle(OPENED_CONTRACT)).toBeVisible();

  const distribution = entryFor(page, "Distribución de ingresos");
  await expect(distribution).toContainText("Estado: Observado");
  await expect(factValue(distribution, "Estado")).toHaveText("Confirmada en el ledger");
  await expect(factValue(distribution, "Período")).toHaveText(RECORDED_PERIOD);
  await expect(distribution.getByTitle(DISTRIBUTION_TX_HASH)).toBeVisible();
});

test("refuses a distribution before the vault reached its goal", async ({ page }) => {
  // The preseeded fixture is still funding: a vault that never settled has nothing to distribute.
  await page.goto(`/distribution?application=${DEMO_APPLICATION_ID}&campaign=${FUNDING_CAMPAIGN_ID}`);
  await connectAs(page, SME_ACCOUNT_OK);

  await page.getByRole("button", { name: "Preparar distribución" }).click();

  await expect(page.locator('p[role="alert"]')).toContainText(
    "La campaña todavía no se liquidó en la cadena, y solo se distribuye sobre una campaña liquidada. Complete el fondeo y la liquidación primero."
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("refuses a second distribution for the same campaign and period, without duplicating it", async ({
  page,
  request
}) => {
  await settleFundingCampaignAsInvestor(page);
  await recordNextSalesPeriod(request);
  await distributeAsSme(page);

  // The same campaign and period again: the service refuses and nothing is registered twice.
  await page.getByRole("button", { name: "Preparar distribución" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText(
    "Ya existe una distribución para este período de esta campaña. No se registró otra."
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
