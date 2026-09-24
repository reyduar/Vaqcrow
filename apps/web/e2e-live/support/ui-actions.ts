import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Page-object-ish helpers for driving the real funding page
 * (`apps/web/src/presentation/components/campaign-workspace.tsx`). Deliberately
 * duplicated from `apps/web/e2e/campaign-vault.spec.ts` rather than imported —
 * `e2e-live/` is its own opt-in suite with its own config, and importing
 * across suites would blur which one is exercising the real network.
 */

/** Scoped past Next's own empty route-announcer `<div role="alert">` — see `campaign-vault.spec.ts`'s identical note. */
export function errorBanner(page: Page) {
  return page.locator('p[role="alert"]');
}

/** The `<dd>` following an exact-text `<dt>` label — several labels can carry the same "N XLM" text. */
export function ddValueFor(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator("xpath=following-sibling::dd[1]");
}

export async function connectWallet(page: Page, expectedPublicKey: string): Promise<void> {
  await page.getByRole("button", { name: "Conectar wallet" }).click();
  await expect(page.getByText(`Wallet conectada: ${expectedPublicKey}`)).toBeVisible({ timeout: 20_000 });
}

/** Fills and submits the open-vault panel; returns the campaign id the router writes into `?campaign=`. */
export async function openVaultThroughUi(
  page: Page,
  input: { readonly goalXlm: string; readonly deadlineDateInput: string }
): Promise<string> {
  await page.getByLabel("Meta (XLM)").fill(input.goalXlm);
  await page.getByLabel("Fecha límite").fill(input.deadlineDateInput);
  await page.getByRole("button", { name: "Abrir bóveda" }).click();

  // Opening a real vault costs a real account-creation transaction plus a
  // real factory deploy against the local network — generous timeout.
  await expect(page).toHaveURL(/[?&]campaign=/, { timeout: 60_000 });
  const url = new URL(page.url());
  const campaignId = url.searchParams.get("campaign");
  if (!campaignId) throw new Error(`Expected a campaign id in ${page.url()}`);
  return campaignId;
}

export async function contribute(page: Page, amountXlm: string): Promise<void> {
  await page.getByLabel("Monto a aportar (XLM)").fill(amountXlm);
  await page.getByRole("button", { name: "Aportar" }).click();
}

export async function withdraw(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Retirar mi aporte" }).click();
}

export async function refund(page: Page, targetAccountId?: string): Promise<void> {
  if (targetAccountId) {
    await page.getByLabel("Cuenta a reembolsar (opcional)").fill(targetAccountId);
  }
  await page.getByRole("button", { name: "Reembolsar" }).click();
}

/**
 * Runs `check`; on failure, reloads the campaign view once and retries.
 *
 * `useCampaignVault`'s post-submit poll is bounded (10 attempts × 1.5s ≈
 * 13.5s in production — `apps/web/src/state/use-campaign-vault.ts`, not
 * configurable from `CampaignWorkspace`'s props). Against a real local
 * network under load that bound can be tighter than the actual confirmation
 * time even though the transaction *did* settle, which would otherwise show
 * as a transient "no se pudo confirmar" error in the UI. A reload re-reads
 * the chain-observed snapshot directly (`loadCampaign`'s initial effect),
 * unbounded, so this distinguishes "genuinely wrong" from "the hook's own
 * bounded poll was too short this time" without touching production code.
 */
export async function eventuallyOnChain(page: Page, campaignUrl: string, check: () => Promise<void>): Promise<void> {
  try {
    await check();
  } catch {
    await page.goto(campaignUrl);
    await check();
  }
}
