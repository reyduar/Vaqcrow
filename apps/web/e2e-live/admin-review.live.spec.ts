import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { accessTokenFor, confirmEmail, signUpThroughAuthApi, type SupabaseTarget } from "./support/auth";
import { assessmentStatusFor, businessForApplication, setBusinessDeadline, type AssessmentStatus } from "./support/db";
import { readDockerEnv } from "./support/docker-env";
import { installLiveFreighterEmulator, setLiveFreighterScenario } from "./support/freighter-live-emulator";
import { nativeBalanceStroops, waitForAccount } from "./support/horizon";
import { createFundedIdentity, createUnfundedIdentity, keypairFor } from "./support/identities";
import { LIVE_APP_BASE_URL } from "./support/live-targets";
import { pollUntil } from "./support/poll";
import { readVault, simulateContribute } from "./support/soroban";
import { syntheticPdf, syntheticPng } from "./support/synthetic-files";
import {
  ensureActiveRate,
  expectedGoalStroops,
  getCampaign,
  getDeployment,
  prepareContribution,
  submitContribution,
  transactionStatus,
  type WireRate
} from "./support/vaqcrow-api";

/**
 * Feature #410, U9 — a real rehearsal of the role-based admin flow against
 * the docker profile (`docs/architecture/environments.md` §11–§12): local
 * Supabase (Auth + Mailpit + Storage + Postgres), this branch's API container
 * and the Stellar Quickstart local network with a factory built from the
 * capped vault wasm (T3b). No doubles for Vaqcrow's own services; the KYC
 * step, the sales history and the ARS/USD rate stay simulated exactly as the
 * product simulates them, and the AI calls go to the provider configured in
 * `.env.docker`.
 *
 * Where the role-based UI has no control for a step, the rehearsal calls the
 * same real route the product would and says so in the step title:
 * the FX rate (`POST /admin/rates`) and the investors' contributions
 * (`POST /campaigns/:id/invocations[/submission]`, signed in this process).
 * The advisory assessment is no longer triggered here: since U12 the API
 * starts it in the background when the submission applies, and the rehearsal
 * only waits (read-only) for the review to reach `human_review`. The one data step is the PyME's deadline, which the wizard
 * cannot capture yet (see `support/db.ts`'s `setBusinessDeadline`).
 *
 * Option A: every run creates a fresh PyME, application and vault; nothing is
 * reset. Synthetic data only; no Testnet, no remote Supabase.
 */

const PASSWORD = "ensayo-u9-Secret-123";
const DEMO_GOAL_ARS = 15_000_000n;
const DEMO_GOAL_LABEL = "15.000.000";
/** Freighter reports Testnet for the SEP-53 wallet link (`FreighterWallet.signMessage` only links on Testnet); the link itself is network-independent. */
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const REQUIRED_DOCUMENTS = ["Declaraciones de ventas", "Constancia de CUIT", "Estatuto"] as const;

/** Per-run log of public facts (ids, hashes, outcomes) printed at the end for the task log. */
const facts: Record<string, unknown> = {};

function record(key: string, value: unknown): void {
  facts[key] = value;
  process.stdout.write(`[u9] ${key}: ${typeof value === "string" ? value : stringify(value)}\n`);
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => (typeof inner === "bigint" ? inner.toString() : inner));
}

async function signUpPymeThroughUi(page: Page, name: string, email: string): Promise<void> {
  await page.goto("/signup?role=pyme");
  await expect(page.getByRole("heading", { level: 2, name: "Creá tu cuenta" })).toBeVisible();
  await page.getByLabel("Nombre o Razón Social").fill(name);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Registrá tu PyME" })).toBeVisible({ timeout: 30_000 });
}

async function signInPymeThroughUi(page: Page, email: string): Promise<void> {
  await page.goto("/login?role=pyme");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(/\/company$/, { timeout: 30_000 });
}

async function uploadDocuments(page: Page, companyName: string): Promise<void> {
  for (const title of REQUIRED_DOCUMENTS) {
    const fileName = `${title.replace(/\s+/g, "-").toLowerCase()}-sintetico.pdf`;
    await page.getByLabel(title).setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: syntheticPdf([
        `${title} - ${companyName}`,
        "CUIT 30-71234567-8 - Cordoba, Argentina",
        "DOCUMENTO SINTETICO DE DEMO - sin validez legal",
        "Generado por el ensayo U9 de Vaqcrow (red local)."
      ])
    });
    await expect(page.getByText(fileName)).toBeVisible({ timeout: 30_000 });
  }
  await page.getByLabel("Agregar foto").setInputFiles({
    name: "foto-local-sintetica.png",
    mimeType: "image/png",
    buffer: syntheticPng()
  });
  await expect(page.getByRole("img", { name: "Vista previa de la foto 1" })).toBeVisible({ timeout: 30_000 });
}

async function signInAdminThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/admin");
  const form = page.getByRole("form", { name: "Ingreso de administrador" });
  await form.getByLabel("Correo").fill(email);
  await form.getByLabel("Contraseña").fill(password);
  await form.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/admin\/pymes$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "PyMEs" })).toBeVisible();
}

/** Prepares through the API, signs in this process as the investor, submits, and waits for the ledger outcome. */
async function contributeThroughApi(
  token: string,
  campaignId: string,
  investorPublicKey: string,
  amountStroops: bigint
): Promise<string> {
  const prepared = await prepareContribution(token, campaignId, investorPublicKey, amountStroops);
  expect(prepared.status, JSON.stringify(prepared.body)).toBe(200);
  const invocation = prepared.body.contractInvocation;
  if (!invocation) throw new Error("prepare returned no contractInvocation");

  const transaction = TransactionBuilder.fromXDR(invocation.xdr, invocation.networkPassphrase);
  transaction.sign(keypairFor(investorPublicKey));
  const submitted = await submitContribution(token, campaignId, investorPublicKey, amountStroops, transaction.toXDR());
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(202);
  const hash = submitted.body.transactionHash;
  if (!hash) throw new Error("submission returned no transactionHash");

  const outcome = await pollUntil(
    () => transactionStatus(token, campaignId, hash),
    (response) => response.status === 200 && response.body.status !== "pending",
    { timeoutMs: 60_000, intervalMs: 1_500, description: `contribution ${hash} to leave pending` }
  );
  expect(outcome.body.status, `contribution ${hash}`).toBe("success");
  return hash;
}

test("U9: a real PyME application is reviewed and approved in /admin, its capped vault deploys on the local network and settles", async ({
  page,
  browser
}) => {
  test.setTimeout(20 * 60_000);

  const env = readDockerEnv([
    "VAQCROW_SUPERADMIN_EMAIL",
    "VAQCROW_SUPERADMIN_PASSWORD",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  ]);
  const supabase: SupabaseTarget = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  };
  const runId = randomUUID().slice(0, 8);
  const companyName = `Panadería Ensayo U9 ${runId}`;
  const pymeEmail = `pyme.u9.${runId}@example.test`;
  const pymeWallet = createUnfundedIdentity();
  record("runId", runId);
  record("pymePublicKey", pymeWallet.publicKey());

  const adminToken = await accessTokenFor(supabase, env.VAQCROW_SUPERADMIN_EMAIL, env.VAQCROW_SUPERADMIN_PASSWORD);

  let rate: WireRate;
  await test.step("0 · active ARS/USD rate (POST /admin/rates — no admin UI yet)", async () => {
    const ensured = await ensureActiveRate(adminToken);
    rate = ensured.rate;
    record("rate", { ...ensured.rate, created: ensured.created });
  });

  await installLiveFreighterEmulator(page);

  await test.step("1 · PyME signs up in the UI and confirms through the email in Mailpit", async () => {
    await signUpPymeThroughUi(page, companyName, pymeEmail);
    await confirmEmail(pymeEmail);
    await signInPymeThroughUi(page, pymeEmail);
  });

  let submittedAt = 0;
  await test.step("2 · onboarding wizard: KYC, registration with real uploads, AI checks, wallet and send to review", async () => {
    await page.getByRole("button", { name: "Registrar mi PyME" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Verificación de identidad" })).toBeVisible();
    await page.getByRole("button", { name: "Iniciar verificación simulada" }).click();
    await expect(page.getByText("KYC aprobado · SIMULADO")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Siguiente paso" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Registrá tu PyME" })).toBeVisible();
    await page.getByRole("button", { name: "Completar con datos de ejemplo" }).click();
    await page.getByLabel("Razón social").fill(companyName);
    await expect(page.getByLabel("Meta de financiamiento (ARS)")).toHaveValue(DEMO_GOAL_LABEL);
    await uploadDocuments(page, companyName);
    await page.getByRole("button", { name: "Enviar a evaluación AI" }).click();

    // Step 3 calls the real completeness check (declared data + the vision pass).
    await expect(page.getByRole("heading", { level: 1, name: "Evaluación AI" })).toBeVisible({ timeout: 30_000 });
    const continueButton = page.getByRole("button", { name: "Continuar" });
    await expect(continueButton).toBeVisible({ timeout: 180_000 });
    record(
      "step3Text",
      (
        await page
          .locator("section")
          .filter({ has: page.getByRole("heading", { level: 1, name: "Evaluación AI" }) })
          .innerText()
      ).slice(0, 2000)
    );
    await continueButton.click();

    await expect(page.getByRole("heading", { level: 1, name: "Qué pasa ahora" })).toBeVisible();
    await setLiveFreighterScenario(page, {
      publicKey: pymeWallet.publicKey(),
      networkPassphrase: TESTNET_PASSPHRASE,
      network: "TESTNET"
    });
    // Like the deterministic spec: the first send is gated on the mandatory wallet, which reveals «Conectar Freighter».
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page.getByText("Conectá tu wallet Freighter para poder enviar la solicitud a revisión.")).toBeVisible();
    await page.getByRole("button", { name: "Conectar Freighter" }).click();
    await expect(page.getByText(/Wallet Freighter conectada/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page.getByText("Solicitud enviada a revisión. Te avisamos cuando haya una decisión.")).toBeVisible({
      timeout: 60_000
    });
    // U12: the API starts the assessment when the submission applies; step 4 times it from here.
    submittedAt = Date.now();
    await expect(
      page.getByRole("region", { name: "Revisión humana" }).getByText("En proceso", { exact: true })
    ).toBeVisible();
  });

  // The admin works in a separate browser context: no PyME session leaks in.
  const adminContext = await browser.newContext({ baseURL: LIVE_APP_BASE_URL });
  const admin = await adminContext.newPage();
  let applicationId = "";
  await test.step("3 · admin signs in at /admin and opens the application from the queue", async () => {
    await signInAdminThroughUi(admin, env.VAQCROW_SUPERADMIN_EMAIL, env.VAQCROW_SUPERADMIN_PASSWORD);
    await admin.getByLabel("Buscar PyMEs").fill(runId);
    await admin.getByLabel("Buscar PyMEs").press("Enter");
    const row = admin.getByRole("row", { name: new RegExp(companyName) });
    await expect(row).toBeVisible({ timeout: 30_000 });
    record("queueRowText", await row.innerText());
    await row.getByRole("link", { name: "Revisar solicitud" }).click();
    await expect(admin).toHaveURL(/\/admin\/pymes\/[0-9a-f-]{36}$/);
    applicationId = new URL(admin.url()).pathname.split("/").pop() ?? "";
    record("applicationId", applicationId);
    await expect(admin.getByRole("heading", { level: 1, name: `Revisión: ${companyName}` })).toBeVisible({
      timeout: 30_000
    });
  });

  await test.step("4 · the automatic assessment (U12) moves the review to human_review; the decision opens", async () => {
    // No admin call: the submission itself started the assessment. Poll the
    // review read-only (bounded; the real model call can take tens of seconds).
    const status = await pollUntil<AssessmentStatus>(
      () => Promise.resolve(assessmentStatusFor(applicationId)),
      (value) => value.state !== "awaiting_assessment",
      { timeoutMs: 180_000, intervalMs: 2_000, description: `application ${applicationId} to leave awaiting_assessment` }
    );
    record("autoAssessment", {
      ...status,
      secondsFromSendToObserved: Math.round((Date.now() - submittedAt) / 100) / 10
    });
    expect(status.state).toBe("human_review");
    // Exactly one outcome: a recorded advisory assessment keyed by the application id, or the manual-review handoff.
    expect(status.attemptId === applicationId || status.failureCode !== null).toBe(true);

    await admin.reload();
    if (status.attemptId !== null) {
      await expect(admin.getByRole("heading", { level: 2, name: "2 · Recomendación de IA" })).toBeVisible({
        timeout: 30_000
      });
    }
    // The decision section always renders «Registrar decisión»; it is enabled
    // only in `human_review` with no decision (`decisionFormOpen`).
    await expect(admin.getByRole("button", { name: "Registrar decisión" })).toBeEnabled({ timeout: 30_000 });
  });

  await test.step("5 · a document verdict and the private document viewer", async () => {
    const cuitVerdicts = admin.getByRole("group", { name: "Estado de Constancia de CUIT" });
    const valid = cuitVerdicts.getByRole("button", { name: "Válido", exact: true });
    await valid.click();
    await expect(valid).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });

    const storageRead = admin.waitForResponse(
      (response) => response.request().method() === "GET" && response.url().includes("/storage/uploads?path=")
    );
    // The viewer opens an empty tab first and then points it at a `blob:` URL.
    // Headless Chromium has no PDF viewer, so that navigation becomes a download
    // and the frame aborts (`net::ERR_ABORTED`): accept either a `blob:`
    // navigation or a `blob:` download, both observed from the popup's first event.
    const popupBlobUrl = new Promise<{ via: "navigation" | "download"; url: string; popup: Page }>((resolve) => {
      admin.once("popup", (popup) => {
        popup.on("framenavigated", (frame) => {
          if (frame === popup.mainFrame() && frame.url().startsWith("blob:")) {
            resolve({ via: "navigation", url: frame.url(), popup });
          }
        });
        popup.on("download", (download) => {
          if (download.url().startsWith("blob:")) resolve({ via: "download", url: download.url(), popup });
        });
      });
    });
    await admin.getByRole("button", { name: "Abrir Constancia de CUIT" }).click();
    const read = await storageRead;
    expect(read.status()).toBe(200);
    expect(read.headers()["content-type"]).toContain("application/pdf");
    expect(read.request().headers()["authorization"]).toMatch(/^Bearer \S+$/);
    const opened = await popupBlobUrl;
    record("viewerPopup", { scheme: new URL(opened.url).protocol, via: opened.via });
    await opened.popup.close();
  });

  await test.step("6 · «Aprobar con límite» with a reason, confirmed in the alertdialog", async () => {
    await expect(admin.getByLabel("Límite aprobado (ARS)")).toHaveValue(DEMO_GOAL_LABEL);
    await admin.locator("label").filter({ hasText: "Aprobar con límite" }).click();
    await expect(admin.getByRole("radio", { name: "Aprobar con límite" })).toBeChecked();
    await admin.getByLabel("Razón").fill(`Ensayo U9 ${runId}: documentación sintética revisada en red local.`);
    await admin.getByRole("button", { name: "Registrar decisión" }).click();
    const dialog = admin.getByRole("alertdialog");
    await expect(dialog).toContainText(`Aprobada con límite ARS ${DEMO_GOAL_LABEL}.`);
    record("alertdialogText", await dialog.innerText());
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(admin.getByRole("status").filter({ hasText: /^Registrada por .+ · .+ · Aprobada$/ })).toBeVisible({
      timeout: 30_000
    });
  });

  let campaignId = "";
  await test.step("7 · the deployment panel reaches «Bóveda confirmada / PyME publicada»", async () => {
    await expect(admin.getByRole("heading", { level: 2, name: "Despliegue de la bóveda" })).toBeVisible({ timeout: 30_000 });
    const confirmed = admin.getByText("Bóveda confirmada / PyME publicada", { exact: true });
    const failed = admin.getByText("Despliegue fallido", { exact: true });
    const deployButton = admin.getByRole("button", { name: "Desplegar" });
    await expect(confirmed.or(failed).or(deployButton)).toBeVisible({ timeout: 180_000 });

    if (await deployButton.isVisible()) {
      record("deploymentFirstRead", "no record yet (Desplegar offered)");
      await deployButton.click();
      await expect(confirmed.or(failed)).toBeVisible({ timeout: 180_000 });
    }

    if (await failed.isVisible()) {
      const panelText = await admin
        .getByRole("heading", { level: 2, name: "Despliegue de la bóveda" })
        .locator("xpath=ancestor::section[1]")
        .innerText();
      const firstRead = await getDeployment(adminToken, applicationId);
      record("deploymentFirstAttempt", { panelText, api: firstRead.body.deployment });

      if (firstRead.body.deployment?.lastError !== "terms_unavailable") {
        throw new Error(`Deployment failed for a reason the rehearsal does not work around: ${JSON.stringify(firstRead.body)}`);
      }
      const business = businessForApplication(applicationId);
      record("businessBeforeDeadline", { businessId: business.businessId, goalArs: business.goalArs.toString(), deadline: business.deadline });
      const deadlineIso = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString().replace(/\.\d{3}Z$/, ".000Z");
      setBusinessDeadline(business.businessId, deadlineIso);
      record("deadlineSetByHarness", deadlineIso);

      await admin.getByRole("button", { name: "Reintentar" }).click();
      await expect(confirmed).toBeVisible({ timeout: 180_000 });
    }

    await admin.getByRole("button", { name: "Ver detalle" }).click();
    const deployment = await getDeployment(adminToken, applicationId);
    expect(deployment.status).toBe(200);
    expect(deployment.body.deployment?.state).toBe("confirmed");
    campaignId = deployment.body.deployment?.campaignId ?? "";
    expect(campaignId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(admin.getByText(campaignId)).toBeVisible();
    record("deployment", deployment.body.deployment);
  });

  let contractAddress = "";
  let goalStroops = 0n;
  await test.step("8 · on-chain: the vault exists, its goal is the converted limit and its destination is the PyME key", async () => {
    const campaign = await getCampaign(adminToken, campaignId);
    contractAddress = campaign.contractAddress;
    goalStroops = BigInt(campaign.goalStroops);
    record("campaign", campaign);

    const business = businessForApplication(applicationId);
    expect(business.goalArs).toBe(DEMO_GOAL_ARS);
    expect(goalStroops).toBe(expectedGoalStroops(DEMO_GOAL_ARS, rate));
    expect(campaign.smeAccountId).toBe(pymeWallet.publicKey());
    expect(campaign.state).toBe("funding");

    // Independent of the API: read the vault itself through Soroban RPC.
    await waitForAccount(pymeWallet.publicKey(), 60_000);
    const probe = await createFundedIdentity();
    const onChainGoal = await readVault(probe.publicKey(), contractAddress, "goal");
    const onChainSme = await readVault(probe.publicKey(), contractAddress, "sme");
    const onChainTotal = await readVault(probe.publicKey(), contractAddress, "total");
    record("onChain", { goal: String(onChainGoal), sme: onChainSme, total: String(onChainTotal) });
    expect(BigInt(onChainGoal as bigint)).toBe(goalStroops);
    expect(onChainSme).toBe(pymeWallet.publicKey());
  });

  await test.step("9 · contributions: above goal/10 is refused (API and contract); capped investors settle the vault", async () => {
    const investorEmail = `inversor.u9.${runId}@example.test`;
    await signUpThroughAuthApi(supabase, {
      email: investorEmail,
      password: PASSWORD,
      role: "INVERSOR",
      displayName: `Inversor Ensayo U9 ${runId}`
    });
    await confirmEmail(investorEmail);
    const investorToken = await accessTokenFor(supabase, investorEmail, PASSWORD);

    const cap = goalStroops / 10n;
    record("capStroops", cap.toString());

    const greedy = await createFundedIdentity();
    const overCap = await prepareContribution(investorToken, campaignId, greedy.publicKey(), cap + 1n);
    record("overCapApi", { status: overCap.status, body: overCap.body });
    expect(overCap.status).toBe(422);
    expect(overCap.body.code).toBe("investor_limit_exceeded");

    const overCapOnChain = await simulateContribute(greedy.publicKey(), contractAddress, cap + 1n);
    record("overCapContract", overCapOnChain);
    expect(overCapOnChain.ok).toBe(false);
    if (!overCapOnChain.ok) expect(overCapOnChain.error).toContain("Error(Contract, #10)");

    const smeBefore = await nativeBalanceStroops(pymeWallet.publicKey());
    if (smeBefore === undefined) throw new Error("the PyME account should exist after the deploy");

    const hashes: string[] = [];
    let remaining = goalStroops;
    while (remaining > 0n) {
      const amount = remaining < cap ? remaining : cap;
      const investor = await createFundedIdentity();
      hashes.push(await contributeThroughApi(investorToken, campaignId, investor.publicKey(), amount));
      remaining -= amount;
    }
    record("contributionHashes", hashes);

    const settled = await pollUntil(
      () => getCampaign(investorToken, campaignId),
      (campaign) => campaign.state === "settled",
      { timeoutMs: 60_000, description: "the vault to settle" }
    );
    record("settledCampaign", { state: settled.state, totalStroops: settled.totalStroops });
    expect(BigInt(settled.totalStroops)).toBe(goalStroops);

    const smeAfter = await pollUntil(
      () => nativeBalanceStroops(pymeWallet.publicKey()),
      (balance) => balance !== undefined && balance >= smeBefore + goalStroops,
      { description: "the PyME's balance to rise by the goal" }
    );
    record("pymeBalanceDeltaStroops", ((smeAfter ?? 0n) - smeBefore).toString());
  });

  await adminContext.close();
  process.stdout.write(`[u9] FACTS ${stringify(facts)}\n`);
});
