import type { Page } from "@playwright/test";
import { expect, test } from "./support/local-only";
import { installFreighterEmulator, setFreighterScenario } from "./support/freighter-emulator";
import { DEMO_APPLICATION_ID, STUB_API_BASE_URL } from "./support/targets";

/**
 * The distribution step against the stub API double (T5b). The stub derives the
 * demo case the way the real API does (2026-08, 3,745,800 ARS at 450 bps is a
 * 168,561 ARS obligation), so the page must show that derivation before
 * anything is signed, and must explain a refused derivation truthfully.
 *
 * The campaign is settled by driving the real funding step as the investor: its
 * transaction poll names the investor, which is what makes the API mirror the
 * contribution and lets a distribution be derived at all.
 *
 * Literals are duplicated from `support/stub-campaign-routes.mjs` on purpose
 * (`e2e/` does not import from `src/`; the stub stays the source of truth).
 */
const SME_ACCOUNT_OK = `G${"A".repeat(55)}`;
const INVESTOR_ACCOUNT_OK = `G${"C".repeat(55)}`;
const FUNDING_CAMPAIGN_ID = "40000000-0000-4000-8000-000000000000";
const STUB_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

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

/** Funds the stub's 20 XLM campaign in full as the investor, so it settles. */
async function settleCampaignAsInvestor(page: Page) {
  await page.goto(`/funding?application=${DEMO_APPLICATION_ID}&campaign=${FUNDING_CAMPAIGN_ID}`);
  await connectAs(page, INVESTOR_ACCOUNT_OK);
  await page.getByLabel("Monto a aportar (XLM)").fill("20");
  await page.getByRole("button", { name: "Aportar" }).click();
  await page.getByRole("button", { name: "Firmar en Freighter" }).click();
  await expect(page.getByText("Meta alcanzada")).toBeVisible();
}

test.beforeEach(async ({ request, page }) => {
  await request.post(`${STUB_API_BASE_URL}/__reset`);
  await installFreighterEmulator(page);
});

test.describe("distribution step", () => {
  test("asks to fund the campaign first when the journey has no campaign", async ({ page }) => {
    await page.goto(`/distribution?application=${DEMO_APPLICATION_ID}`);

    await expect(page.getByRole("status").filter({ hasText: "primero hay que fondear la campaña" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir al fondeo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Preparar distribución" })).toHaveCount(0);
  });

  test("shows the derived obligation before signing and submits the derived distribution", async ({ page }) => {
    await settleCampaignAsInvestor(page);
    await page.goto(`/distribution?application=${DEMO_APPLICATION_ID}&campaign=${FUNDING_CAMPAIGN_ID}`);
    await connectAs(page, SME_ACCOUNT_OK);

    await page.getByRole("button", { name: "Preparar distribución" }).click();

    const review = page.getByRole("dialog");
    await expect(review).toBeVisible();
    await expect(review).toContainText("2026-08");
    await expect(review).toContainText("ARS 3.745.800");
    await expect(review).toContainText("4,50 %");
    await expect(review).toContainText("ARS 168.561");
    // The investor funded the whole goal, so they receive the whole converted obligation.
    await expect(review).toContainText("0.674244 XLM");

    // The page behind the review carries the full breakdown, labeled simulated.
    const derivation = page.getByRole("region", { name: "Cálculo de la distribución" });
    await expect(derivation).toContainText("SIMULADO");
    await expect(derivation).toContainText("2026-04: Período faltante (faltan datos)");
    await expect(derivation).toContainText("2026-06: Período anómalo (requiere revisión)");
    await expect(derivation).toContainText("ARS 5.000.000");
    await expect(derivation).toContainText(INVESTOR_ACCOUNT_OK);

    // The checkbox control is a styled overlay over the native input, so the label is what a person presses.
    await review.getByText("Confirmo que revisé los destinatarios y los montos").click();
    await review.getByRole("button", { name: "Firmar en Freighter" }).click();

    await expect(page.getByText("Enviada · pendiente de confirmación")).toBeVisible();
  });

  test("explains that only the SME's account can sign when another account is connected", async ({ page }) => {
    await settleCampaignAsInvestor(page);
    await page.goto(`/distribution?application=${DEMO_APPLICATION_ID}&campaign=${FUNDING_CAMPAIGN_ID}`);
    await connectAs(page, INVESTOR_ACCOUNT_OK);

    await page.getByRole("button", { name: "Preparar distribución" }).click();

    await expect(page.locator('p[role="alert"]')).toContainText(
      "Conecte en Freighter la cuenta de la PyME de esta campaña"
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
