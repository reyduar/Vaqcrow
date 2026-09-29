import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/local-only";
import { DEMO_APPLICATION_ID, STUB_API_BASE_URL } from "./support/targets";

/**
 * Task #92 built the `/evidence` dashboard; its unit and component suites are
 * done. This spec proves the route, the container, the HTTP gateway and the pure
 * projection agree in a real browser against the local stub — the one layer the
 * unit tests approximate with mocked routers.
 *
 * Both cases stay local-only: `./support/local-only`'s auto-fixture fails the
 * test if the browser touches anything but the app and the stub, and this step
 * never connects a wallet (nothing here signs anything).
 */

/**
 * Same `<dl>` scoping rationale as `campaign-vault.spec.ts`: a row's value can
 * repeat elsewhere on the page, so every amount is read from its own `<dt>`
 * label instead of a bare `getByText` that could match more than one element.
 */
function factValue(entry: Locator, label: string) {
  return entry.getByText(label, { exact: true }).locator("xpath=following-sibling::dd[1]");
}

/**
 * The timeline is a flat `<ol>` of `<li>` entries. Scoping by each entry's own
 * `<h3>` title keeps a string that legitimately appears twice — "Contrato de la
 * bóveda" is both the campaign's evidence badge and its hash label — from
 * breaking Playwright's strict mode.
 */
function entryFor(page: Page, title: string) {
  return page.locator("li").filter({ has: page.getByRole("heading", { name: title, level: 3 }) });
}

/** The `<section aria-label>` the timeline declares; asserted by accessible name, never by tag. */
const TIMELINE_NAME = "Evidencia de la ejecución";

/**
 * The funding fixture's id and contract address, duplicated literally from
 * `support/stub-campaign-routes.mjs` (`FUNDING_CAMPAIGN_ID`, `CONTRACT_FUNDING`)
 * on purpose: `e2e/` must not import from `src/`, and the stub stays the single
 * source of truth for what each id names — the same convention
 * `campaign-vault.spec.ts` documents for its account ids.
 */
const FUNDING_CAMPAIGN_ID = "40000000-0000-4000-8000-000000000000";
const FUNDING_CONTRACT = `C${"K".repeat(55)}`;

test.beforeEach(async ({ request }) => {
  // Keep each test independent of any request a previous test submitted.
  await request.post(`${STUB_API_BASE_URL}/__reset`);
});

test.describe("without an id in the URL", () => {
  test("renders every unread source as absent when nothing ran in this session", async ({ page }) => {
    await page.goto("/evidence");

    const timeline = page.getByRole("region", { name: TIMELINE_NAME });
    await expect(timeline).toBeVisible();

    // The synthetic case is always part of the recap and is the only observed
    // entry: it carries its SIMULADO provenance badge.
    const synthetic = entryFor(page, "Caso simulado");
    await expect(synthetic).toContainText("Estado: Observado");
    await expect(synthetic).toContainText("SIMULADO");
    await expect(factValue(synthetic, "Solicitud")).toHaveText(DEMO_APPLICATION_ID);

    // The stub answers the decision read with its own `404 { code: "not_found" }`,
    // which the gateway maps to a truthful absence — not to a failure.
    const decision = entryFor(page, "Decisión humana");
    await expect(decision).toContainText("Estado: Ausente");
    await expect(decision).toContainText("No hay una decisión humana registrada para esta solicitud.");

    // No `?campaign=`, so the vault was never read: absent, not "could not read".
    const vault = entryFor(page, "Bóveda de campaña");
    await expect(vault).toContainText("Estado: Ausente");
    await expect(vault).toContainText("No hay una bóveda de campaña en esta sesión.");

    // No `?distribution=` either: the distribution is absent by the same rule.
    const distribution = entryFor(page, "Distribución de ingresos");
    await expect(distribution).toContainText("Estado: Ausente");
    await expect(distribution).toContainText("No hay una distribución de ingresos en esta sesión.");

    // Nothing ran, so nothing may read as confirmed: the distribution's confirmed
    // wording and the decision's approved wording must not appear in the recap.
    await expect(timeline.getByText("Confirmada en el ledger")).toHaveCount(0);
    await expect(timeline.getByText("Aprobada")).toHaveCount(0);
  });
});

test.describe("with the campaign id in the URL", () => {
  test("renders the vault as observed once the campaign id is in the URL", async ({ page }) => {
    await page.goto(`/evidence?campaign=${FUNDING_CAMPAIGN_ID}`);

    const timeline = page.getByRole("region", { name: TIMELINE_NAME });
    await expect(timeline).toBeVisible();

    // The stub reports the funding fixture open with its goal in XLM and zero
    // contributed; the projection pre-formats both from the wire's stroops.
    const vault = entryFor(page, "Bóveda de campaña");
    await expect(vault).toContainText("Estado: Observado");
    await expect(factValue(vault, "Estado")).toHaveText("Fondeo abierto");
    await expect(factValue(vault, "Meta")).toHaveText("20 XLM");
    await expect(factValue(vault, "Total aportado")).toHaveText("0 XLM");

    // The contract address comes from the stub's wire and is rendered by
    // `HashDisplay`, which keeps the full value in the element's `title`.
    await expect(vault.getByTitle(FUNDING_CONTRACT)).toBeVisible();

    // The stub's campaign wire carries no `explorerUrl`, and `D1` forbids the web
    // from building one: the hash must render with no explorer link rather than a
    // fabricated one. (The positive "explorer link the API supplied" assertion is
    // therefore not drivable against this stub — see the task report.)
    await expect(vault.getByRole("link", { name: /Ver en el explorador/ })).toHaveCount(0);

    // The decision stays absent (the stub's unmatched GET answers `not_found`) and
    // the distribution stays absent (no `?distribution=` in the URL): neither may
    // render as a read failure or as a success.
    const decision = entryFor(page, "Decisión humana");
    await expect(decision).toContainText("Estado: Ausente");
    await expect(decision).not.toContainText("No disponible");

    const distribution = entryFor(page, "Distribución de ingresos");
    await expect(distribution).toContainText("Estado: Ausente");
    await expect(distribution).not.toContainText("No disponible");
    await expect(timeline.getByText("Confirmada en el ledger")).toHaveCount(0);
  });
});
