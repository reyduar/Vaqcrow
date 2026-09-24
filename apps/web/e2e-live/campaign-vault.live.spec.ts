import { expect, test } from "@playwright/test";
import { getCampaign, openCampaignDirect } from "./support/campaign-api";
import { seedApprovedApplication } from "./support/db";
import { installLiveFreighterEmulator, setLiveFreighterScenario } from "./support/freighter-live-emulator";
import { accountExists, nativeBalanceStroops, waitForAccount } from "./support/horizon";
import { createFundedIdentity, createUnfundedIdentity } from "./support/identities";
import { DEMO_APPLICATION_ID, LIVE_NETWORK_PASSPHRASE, xlmToStroops } from "./support/live-targets";
import { pollUntil } from "./support/poll";
import {
  connectWallet,
  contribute,
  ddValueFor,
  eventuallyOnChain,
  openVaultThroughUi,
  refund,
  withdraw
} from "./support/ui-actions";

/**
 * Opt-in live journey for the campaign vault (Task #248, T4). Drives the
 * real `/funding` page against the docker-profile API and the Stellar
 * Quickstart local network (`docs/architecture/environments.md` §11) — real
 * account creation, real contract calls, real Horizon reads. No stub, no
 * fixtures, no fixed clock. Never part of `pnpm run test:e2e`/`verify`/CI:
 * run with `pnpm --filter @vaqcrow/web run test:e2e:live` once that profile
 * is up; `support/global-setup.ts` fails fast otherwise.
 *
 * **Why only scenario `a` opens through the "Abrir bóveda" panel.** The real
 * `/funding` route never overrides `CampaignWorkspace`'s `applicationId`
 * prop (`apps/web/src/app/(demo)/funding/page.tsx`), so every UI-driven open
 * targets the *same* fixed `DEMO_APPLICATION_ID` — and `openCampaign` is
 * idempotent per application (`apps/api/.../use-cases/open-campaign.ts`), so
 * a second "Abrir bóveda" submit for it just adopts whatever campaign
 * already exists there, ignoring the form's own inputs. One real vault can
 * therefore only ever be *opened* through that panel per local database.
 * Scenarios `b`–`d` open their own, independent campaigns directly against
 * `POST /campaigns` (`support/campaign-api.ts`) — the same real endpoint,
 * just not through the browser — and drive every contribute/withdraw/refund
 * step that follows through the real page. This mirrors the PR-gated
 * `apps/web/e2e/campaign-vault.spec.ts`, which likewise only exercises the
 * open panel in its own "opening the vault" tests and pre-seeds its refund
 * fixture directly.
 */

test.describe("opening the vault", () => {
  test("connecting Freighter opens the vault and its SME account exists on Horizon afterward", async ({ page }) => {
    seedApprovedApplication(DEMO_APPLICATION_ID);
    const sme = createUnfundedIdentity();

    // Always true regardless of replay: this identity was just generated,
    // so it has never touched the ledger.
    expect(await accountExists(sme.publicKey())).toBe(false);

    await installLiveFreighterEmulator(page);
    await page.goto("/funding");
    await setLiveFreighterScenario(page, {
      publicKey: sme.publicKey(),
      networkPassphrase: LIVE_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });

    await connectWallet(page, sme.publicKey());
    const campaignId = await openVaultThroughUi(page, { goalXlm: "50", deadlineDateInput: "2030-01-01" });

    await expect(page.getByRole("heading", { name: "Bóveda de campaña" })).toBeVisible();
    await expect(page.getByText("Fondeo abierto")).toBeVisible();

    // The `smeAccountId` that actually matters this run: ours, on a fresh
    // deploy; the original campaign's, on an idempotent replay against an
    // already-opened `DEMO_APPLICATION_ID`. `campaign-workspace.tsx` never
    // renders it, so it is read back from the API instead of the DOM.
    const campaign = await getCampaign(campaignId);
    await waitForAccount(campaign.smeAccountId, 60_000);
    expect(await accountExists(campaign.smeAccountId)).toBe(true);
  });
});

test.describe("contributing and withdrawing", () => {
  test("a contribution and a withdrawal both reflect on the chain", async ({ page }) => {
    const { applicationId } = seedApprovedApplication();
    const sme = createUnfundedIdentity();
    const investor = await createFundedIdentity();

    const opened = await openCampaignDirect({
      applicationId,
      smeAccountId: sme.publicKey(),
      goalStroops: xlmToStroops(1000),
      deadlineIso: "2030-06-01T00:00:00.000Z"
    });
    const campaignUrl = `/funding?campaign=${opened.campaignId}`;

    await installLiveFreighterEmulator(page);
    await page.goto(campaignUrl);
    await setLiveFreighterScenario(page, {
      publicKey: investor.publicKey(),
      networkPassphrase: LIVE_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });
    await connectWallet(page, investor.publicKey());

    const balanceBeforeContribute = await nativeBalanceStroops(investor.publicKey());
    if (balanceBeforeContribute === undefined) throw new Error("investor account should already be funded by Friendbot");

    await contribute(page, "5");
    await eventuallyOnChain(page, campaignUrl, async () => {
      await expect(ddValueFor(page, "Total aportado")).toHaveText("5 XLM", { timeout: 30_000 });
    });
    const balanceAfterContribute = await pollUntil(
      () => nativeBalanceStroops(investor.publicKey()),
      (balance) => balance !== undefined && balance < balanceBeforeContribute,
      { description: "the investor's balance to drop after contributing" }
    );

    await withdraw(page);
    await eventuallyOnChain(page, campaignUrl, async () => {
      await expect(ddValueFor(page, "Total aportado")).toHaveText("0 XLM", { timeout: 30_000 });
    });
    await pollUntil(
      () => nativeBalanceStroops(investor.publicKey()),
      (balance) => balance !== undefined && balanceAfterContribute !== undefined && balance > balanceAfterContribute,
      { description: "the investor's balance to rise back after withdrawing" }
    );

    const campaign = await getCampaign(opened.campaignId);
    expect(campaign.totalStroops).toBe("0");
  });
});

test.describe("settling the vault", () => {
  test("contributing the full goal settles the vault and pays the SME", async ({ page }) => {
    const { applicationId } = seedApprovedApplication();
    const sme = createUnfundedIdentity();
    const investor = await createFundedIdentity();
    const goalStroops = xlmToStroops(20);

    const opened = await openCampaignDirect({
      applicationId,
      smeAccountId: sme.publicKey(),
      goalStroops,
      deadlineIso: "2030-06-01T00:00:00.000Z"
    });
    const campaignUrl = `/funding?campaign=${opened.campaignId}`;
    await waitForAccount(sme.publicKey(), 60_000);
    const smeBalanceBeforeSettle = await nativeBalanceStroops(sme.publicKey());
    if (smeBalanceBeforeSettle === undefined) throw new Error("SME account should already exist after opening");

    await installLiveFreighterEmulator(page);
    await page.goto(campaignUrl);
    await setLiveFreighterScenario(page, {
      publicKey: investor.publicKey(),
      networkPassphrase: LIVE_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });
    await connectWallet(page, investor.publicKey());

    // The fixture's own goal, contributed in one shot — mirrors the
    // PR-gated spec's "this alone reaches it" fixture.
    await contribute(page, "20");
    await eventuallyOnChain(page, campaignUrl, async () => {
      await expect(page.getByText("Meta alcanzada")).toBeVisible({ timeout: 30_000 });
    });
    await expect(ddValueFor(page, "Total aportado")).toHaveText("20 XLM");
    await expect(page.getByRole("button", { name: "Aportar" })).toHaveCount(0);

    await pollUntil(
      () => nativeBalanceStroops(sme.publicKey()),
      (balance) => balance !== undefined && balance >= smeBalanceBeforeSettle + goalStroops,
      { description: "the SME's balance to increase by the goal after settlement" }
    );
  });
});

test.describe("refunding after the deadline", () => {
  test("a different connected wallet triggers the first, permissionless refund after the deadline", async ({
    page
  }) => {
    const { applicationId } = seedApprovedApplication();
    const sme = createUnfundedIdentity();
    const investor = await createFundedIdentity();
    const refundTrigger = await createFundedIdentity();

    // Only `openCampaignDirect` can express this: `campaign-workspace.tsx`'s
    // `<input type="date">` can only ever declare a deadline at UTC
    // midnight on some date, never "~25 seconds from now" (see this file's
    // top comment).
    //
    // Rounded down to a whole second: the contract's own deadline is a `u64`
    // of unix seconds, and `open-campaign.ts`'s `matchesRequestedVault`
    // compares `state.deadline.getTime() === command.deadline.getTime()`
    // exactly — a millisecond-precise `Date.now()` here would always mismatch
    // the truncated on-chain value and fail the open with
    // `vault_state_mismatch` (found while building this test).
    const deadlineMs = Math.floor((Date.now() + 25_000) / 1000) * 1000;
    const opened = await openCampaignDirect({
      applicationId,
      smeAccountId: sme.publicKey(),
      goalStroops: xlmToStroops(1000),
      deadlineIso: new Date(deadlineMs).toISOString()
    });
    const campaignUrl = `/funding?campaign=${opened.campaignId}`;

    await installLiveFreighterEmulator(page);
    await page.goto(campaignUrl);
    await setLiveFreighterScenario(page, {
      publicKey: investor.publicKey(),
      networkPassphrase: LIVE_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });
    await connectWallet(page, investor.publicKey());

    await contribute(page, "10");
    await eventuallyOnChain(page, campaignUrl, async () => {
      await expect(ddValueFor(page, "Total aportado")).toHaveText("10 XLM", { timeout: 30_000 });
    });
    const investorBalanceAfterContribute = await nativeBalanceStroops(investor.publicKey());
    if (investorBalanceAfterContribute === undefined) throw new Error("investor account should exist by now");

    // Poll wall-clock time rather than a single blind sleep, so the wait is
    // never longer than it has to be. There is no server-time endpoint to
    // poll instead: the contract's own deadline is a fixed instant, and
    // nothing flips `state` on its own before a `refund` call reaches it
    // (`contracts/campaign-vault/src/lib.rs`, `ensure_refundable`).
    await pollUntil(() => Promise.resolve(Date.now()), (now) => now >= deadlineMs, {
      timeoutMs: 45_000,
      intervalMs: 1_000,
      description: "the campaign's deadline to pass"
    });

    // A fresh load, not a live timer: `canRefund` in `campaign-workspace.tsx`
    // reads `Date.now()` at render time, and nothing re-renders the already
    // mounted page on a clock tick. Reloading also gives the *different*
    // wallet its own connection, distinct from the investor's.
    await page.goto(campaignUrl);
    await setLiveFreighterScenario(page, {
      publicKey: refundTrigger.publicKey(),
      networkPassphrase: LIVE_NETWORK_PASSPHRASE,
      network: "LOCAL"
    });
    await connectWallet(page, refundTrigger.publicKey());

    // The bug this task found and fixed (`odd/tasks/campaign-vault-web-tests.md`
    // D5): without the fix, this button never renders — the chain still
    // reports "funding" until the very refund call this test is about to
    // make, and the old gate only offered the form once already refunding.
    await expect(page.getByRole("button", { name: "Reembolsar" })).toBeVisible({ timeout: 15_000 });

    await refund(page, investor.publicKey());
    await eventuallyOnChain(page, campaignUrl, async () => {
      await expect(page.getByText("Reembolso disponible")).toBeVisible({ timeout: 30_000 });
    });

    await pollUntil(
      () => nativeBalanceStroops(investor.publicKey()),
      (balance) => balance !== undefined && balance > investorBalanceAfterContribute,
      { description: "the refunded investor's balance to rise" }
    );
  });
});
