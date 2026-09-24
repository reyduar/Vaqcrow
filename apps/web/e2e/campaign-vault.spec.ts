import type { Page } from "@playwright/test";
import { expect, test } from "./support/local-only";
import { installFreighterEmulator, setFreighterScenario } from "./support/freighter-emulator";
import { STUB_API_BASE_URL } from "./support/targets";

/**
 * The campaign view's `<dl>` renders "Meta", "Total aportado" and (once a
 * viewer is connected) "Tu aporte" as separate rows that can carry the same
 * "N XLM" text — e.g. a campaign at its goal shows the same amount for both
 * "Meta" and "Total aportado". A plain `getByText("N XLM")` would then match
 * more than one element, so every value assertion below is scoped to its
 * own `<dt>` label instead.
 */
function ddValueFor(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator("xpath=following-sibling::dd[1]");
}

/**
 * `CampaignWorkspace`'s own failure banner is a `<p role="alert">`. Next.js
 * itself always renders a second, empty `<div role="alert" id="__next-route-announcer__">`
 * for its route announcer, so a plain `page.getByRole("alert")` resolves to
 * two elements and fails Playwright's strict mode. Scoping to the `p` tag
 * picks out only the workspace's own banner.
 */
function errorBanner(page: Page) {
  return page.locator('p[role="alert"]');
}

/**
 * Issue-critical path 3: the campaign vault journey (Task #248). Drives the
 * real funding page against the deterministic stub campaign routes
 * (`support/stub-campaign-routes.mjs`) with Freighter emulated
 * (`support/freighter-emulator.ts`) — no Testnet, no real wallet extension.
 *
 * Account/campaign ids below are duplicated literally from
 * `support/stub-campaign-routes.mjs` (the same "e2e/ must not import from
 * src/, and cross-boundary fixture literals are duplicated on purpose"
 * convention `targets.ts` already documents) rather than imported, so the
 * stub's own module stays the single source of truth for what each id
 * triggers.
 */
const SME_ACCOUNT_OK = `G${"A".repeat(55)}`;
const SME_ACCOUNT_BLOCKED = `G${"B".repeat(55)}`;
const INVESTOR_ACCOUNT_OK = `G${"C".repeat(55)}`;
const INVESTOR_ACCOUNT_FAILED = `G${"D".repeat(55)}`;
const INVESTOR_ACCOUNT_REFUND_TARGET = `G${"E".repeat(55)}`;
const INVESTOR_ACCOUNT_REFUND_TRIGGER = `G${"F".repeat(55)}`;

const FUNDING_CAMPAIGN_ID = "40000000-0000-4000-8000-000000000000";
const REFUNDING_CAMPAIGN_ID = "30000000-0000-4000-8000-000000000000";

const STUB_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const WRONG_NETWORK_PASSPHRASE = "Public Global Stellar Network ; September 2015";

test.beforeEach(async ({ request, page }) => {
  // Keep every test independent of what a previous test opened, contributed or refunded.
  await request.post(`${STUB_API_BASE_URL}/__reset`);
  await installFreighterEmulator(page);
});

test.describe("opening the vault", () => {
  test("a missing SME account is shown as a blocked state, not a failed payout", async ({ page }) => {
    await page.goto("/funding");
    await setFreighterScenario(page, {
      installed: true,
      publicKey: SME_ACCOUNT_BLOCKED,
      networkPassphrase: STUB_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });

    await page.getByRole("button", { name: "Conectar wallet" }).click();
    await expect(page.getByText(`Wallet conectada: ${SME_ACCOUNT_BLOCKED}`)).toBeVisible();

    await page.getByLabel("Meta (XLM)").fill("50");
    await page.getByLabel("Fecha límite").fill("2030-01-01");
    await page.getByRole("button", { name: "Abrir bóveda" }).click();

    await expect(errorBanner(page)).toContainText(
      "No se pudo crear ni verificar la cuenta de la PyME en Stellar: la bóveda no se abrió, no se desplegó nada y no se movieron fondos."
    );
    // Nothing was opened: the URL never gained a campaign id.
    await expect(page).not.toHaveURL(/campaign=/);
  });

  test("connects Freighter, opens the vault and renders the campaign view", async ({ page }) => {
    await page.goto("/funding");
    await setFreighterScenario(page, {
      installed: true,
      publicKey: SME_ACCOUNT_OK,
      networkPassphrase: STUB_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });

    await page.getByRole("button", { name: "Conectar wallet" }).click();
    await expect(page.getByText(`Wallet conectada: ${SME_ACCOUNT_OK}`)).toBeVisible();

    await page.getByLabel("Meta (XLM)").fill("50");
    await page.getByLabel("Fecha límite").fill("2030-01-01");
    await page.getByRole("button", { name: "Abrir bóveda" }).click();

    await expect(page).toHaveURL(/[?&]campaign=/);
    await expect(page.getByRole("heading", { name: "Bóveda de campaña" })).toBeVisible();
    await expect(page.getByText("Fondeo abierto")).toBeVisible();
    await expect(ddValueFor(page, "Total aportado")).toHaveText("0 XLM");
  });
});

test.describe("contributing", () => {
  test("connects, signs and reflects the new total", async ({ page }) => {
    await page.goto(`/funding?campaign=${FUNDING_CAMPAIGN_ID}`);
    await setFreighterScenario(page, {
      installed: true,
      publicKey: INVESTOR_ACCOUNT_OK,
      networkPassphrase: STUB_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });

    await page.getByRole("button", { name: "Conectar wallet" }).click();
    await expect(page.getByText(`Wallet conectada: ${INVESTOR_ACCOUNT_OK}`)).toBeVisible();

    await page.getByLabel("Monto a aportar (XLM)").fill("5");
    await page.getByRole("button", { name: "Aportar" }).click();

    await expect(ddValueFor(page, "Total aportado")).toHaveText("5 XLM");
    await expect(page.getByText("Fondeo abierto")).toBeVisible();
  });

  test("a contribution that reaches the goal settles the vault and removes the contribute controls", async ({
    page
  }) => {
    await page.goto(`/funding?campaign=${FUNDING_CAMPAIGN_ID}`);
    await setFreighterScenario(page, {
      installed: true,
      publicKey: INVESTOR_ACCOUNT_OK,
      networkPassphrase: STUB_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });

    await page.getByRole("button", { name: "Conectar wallet" }).click();
    await expect(page.getByText(`Wallet conectada: ${INVESTOR_ACCOUNT_OK}`)).toBeVisible();

    // The fixture's goal is 20 XLM; this alone reaches it.
    await page.getByLabel("Monto a aportar (XLM)").fill("20");
    await page.getByRole("button", { name: "Aportar" }).click();

    await expect(page.getByText("Meta alcanzada")).toBeVisible();
    await expect(ddValueFor(page, "Total aportado")).toHaveText("20 XLM");
    await expect(page.getByRole("button", { name: "Aportar" })).toHaveCount(0);
    await expect(
      page.getByText("La bóveda ya no acepta aportes: el contrato rechaza cualquier aporte fuera del estado de fondeo.")
    ).toBeVisible();
  });
});

test.describe("refunding", () => {
  test("refunds another investor's registered address permissionlessly", async ({ page }) => {
    await page.goto(`/funding?campaign=${REFUNDING_CAMPAIGN_ID}`);
    await setFreighterScenario(page, {
      installed: true,
      publicKey: INVESTOR_ACCOUNT_REFUND_TRIGGER,
      networkPassphrase: STUB_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });

    await page.getByRole("button", { name: "Conectar wallet" }).click();
    await expect(page.getByText(`Wallet conectada: ${INVESTOR_ACCOUNT_REFUND_TRIGGER}`)).toBeVisible();
    await expect(page.getByText("Reembolso disponible")).toBeVisible();
    await expect(ddValueFor(page, "Total aportado")).toHaveText("30 XLM");

    await page.getByLabel("Cuenta a reembolsar (opcional)").fill(INVESTOR_ACCOUNT_REFUND_TARGET);
    await page.getByRole("button", { name: "Reembolsar" }).click();

    // The refunded investor's contribution came back; the vault's total drops to zero.
    await expect(ddValueFor(page, "Total aportado")).toHaveText("0 XLM");
  });
});

test.describe("error paths", () => {
  test("Freighter absent is reported, not treated as a rejection", async ({ page }) => {
    await page.goto("/funding");
    await setFreighterScenario(page, null);

    await page.getByRole("button", { name: "Conectar wallet" }).click();

    await expect(errorBanner(page)).toContainText(
      "No se detectó una wallet disponible en este navegador. Instalá o habilitá Freighter.",
      { timeout: 8_000 }
    );
  });

  test("a wallet on the wrong network is reported before anything is signed", async ({ page }) => {
    await page.goto(`/funding?campaign=${FUNDING_CAMPAIGN_ID}`);
    await setFreighterScenario(page, {
      installed: true,
      publicKey: INVESTOR_ACCOUNT_OK,
      networkPassphrase: WRONG_NETWORK_PASSPHRASE,
      network: "OTHER"
    });

    await page.getByRole("button", { name: "Conectar wallet" }).click();
    await expect(page.getByText(`Wallet conectada: ${INVESTOR_ACCOUNT_OK}`)).toBeVisible();

    await page.getByLabel("Monto a aportar (XLM)").fill("5");
    await page.getByRole("button", { name: "Aportar" }).click();

    await expect(errorBanner(page)).toContainText(
      "Tu wallet está en otra red. Cambiala a la red que declara la transacción y volvé a firmar."
    );
    // Nothing was signed or submitted: the total stays untouched.
    await expect(ddValueFor(page, "Total aportado")).toHaveText("0 XLM");
  });

  test("declining the signature is reported and nothing is sent", async ({ page }) => {
    await page.goto(`/funding?campaign=${FUNDING_CAMPAIGN_ID}`);
    await setFreighterScenario(page, {
      installed: true,
      publicKey: INVESTOR_ACCOUNT_OK,
      networkPassphrase: STUB_NETWORK_PASSPHRASE,
      network: "LOCAL",
      onSign: "reject"
    });

    await page.getByRole("button", { name: "Conectar wallet" }).click();
    await expect(page.getByText(`Wallet conectada: ${INVESTOR_ACCOUNT_OK}`)).toBeVisible();

    await page.getByLabel("Monto a aportar (XLM)").fill("5");
    await page.getByRole("button", { name: "Aportar" }).click();

    await expect(errorBanner(page)).toContainText(
      "Rechazaste la firma en la wallet. No se envió nada; podés volver a firmar."
    );
    await expect(ddValueFor(page, "Total aportado")).toHaveText("0 XLM");
  });

  test("a reverted contribution is reported and never claimed as a success", async ({ page }) => {
    await page.goto(`/funding?campaign=${FUNDING_CAMPAIGN_ID}`);
    await setFreighterScenario(page, {
      installed: true,
      publicKey: INVESTOR_ACCOUNT_FAILED,
      networkPassphrase: STUB_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });

    await page.getByRole("button", { name: "Conectar wallet" }).click();
    await expect(page.getByText(`Wallet conectada: ${INVESTOR_ACCOUNT_FAILED}`)).toBeVisible();

    await page.getByLabel("Monto a aportar (XLM)").fill("5");
    await page.getByRole("button", { name: "Aportar" }).click();

    await expect(errorBanner(page)).toContainText(
      "El servicio rechazó la operación. No se registró nada; revisá el estado de la campaña y volvé a intentar."
    );
    // The reverted contribution never landed: the total and state are untouched.
    await expect(ddValueFor(page, "Total aportado")).toHaveText("0 XLM");
    await expect(page.getByText("Fondeo abierto")).toBeVisible();
  });
});
