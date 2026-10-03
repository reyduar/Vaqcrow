import type { Page } from "@playwright/test";
import { expect, test } from "./support/local-only";
import { STUB_SUPABASE_URL } from "./support/targets";

/**
 * Issue #380: account creation, sign-in and the role-aware shell, end to end,
 * against the local Supabase Auth + PostgREST double
 * (`support/stub-supabase-server.mjs`). Email confirmation is required, as in
 * the real project; the spec confirms through the double's control endpoint.
 */
const PASSWORD = "secret-123";

const ROLES = [
  {
    role: "INVERSOR",
    param: "investor",
    nameLabel: "Nombre completo",
    name: "Lucía Fernández",
    email: "lucia.e2e@example.test",
    createdTitle: "Conectá tu wallet",
    createdCta: /Conectar Freighter/,
    confirmFirst: "Antes de conectar Freighter, confirmá tu cuenta con el enlace que te enviamos a tu correo.",
    home: "/portfolio",
    pageTitle: "Mi portafolio",
    nav: ["Explorar PyMEs", "Mi portafolio", "Acerca de"],
    menu: ["Mi portafolio", "Guía del inversor", "Informes", "Cerrar sesión"],
    chip: "INVERSOR"
  },
  {
    role: "PYME",
    param: "pyme",
    nameLabel: "Nombre o Razón Social",
    name: "Panadería Horizonte SRL",
    email: "panaderia.e2e@example.test",
    createdTitle: "Registrá tu PyME",
    createdCta: /Continuar con el KYC simulado/,
    confirmFirst: "Antes de continuar, confirmá tu cuenta con el enlace que te enviamos a tu correo.",
    home: "/company",
    pageTitle: "Mi campaña",
    nav: ["Mi campaña", "Cómo funciona", "Acerca de"],
    menu: ["Mi campaña", "Guía del emprendedor", "Cerrar sesión"],
    chip: "PYME"
  }
] as const;

type RoleCase = (typeof ROLES)[number];

test.beforeEach(async ({ request }) => {
  await request.post(`${STUB_SUPABASE_URL}/__reset`);
});

async function signUp(page: Page, account: RoleCase) {
  await page.goto(`/signup?role=${account.param}`);
  await expect(page.getByRole("heading", { level: 2, name: "Creá tu cuenta" })).toBeVisible();
  await page.getByLabel(account.nameLabel).fill(account.name);
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
}

async function confirm(page: Page, email: string) {
  const response = await page.request.post(`${STUB_SUPABASE_URL}/__confirm`, { data: { email } });
  expect(response.ok()).toBe(true);
}

async function signIn(page: Page, param: string, email: string, password = PASSWORD) {
  await page.goto(`/login?role=${param}`);
  await expect(page.getByRole("heading", { level: 2, name: "Ingresá a tu cuenta" })).toBeVisible();
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

async function expectHome(page: Page, account: RoleCase) {
  await expect(page).toHaveURL(new RegExp(`${account.home}$`));
  await expect(page.getByRole("heading", { level: 1, name: account.pageTitle })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link")).toHaveText([...account.nav]);
}

for (const account of ROLES) {
  test(`${account.role}: create the account, confirm, sign in, sign out and sign back in`, async ({ page }) => {
    await signUp(page, account);

    // Created view per role, without the email anywhere on the page.
    await expect(page.getByRole("heading", { level: 2, name: account.createdTitle })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Cuenta creada." })).toContainText(
      "Confirmá tu correo desde el enlace que te enviamos para poder ingresar."
    );
    await expect(page.locator("body")).not.toContainText(account.email);
    await page.getByRole("button", { name: account.createdCta }).click();
    await expect(page.getByText(account.confirmFirst)).toBeVisible();

    // Signing in before confirming is refused with the template's message.
    await signIn(page, account.param, account.email);
    await expect(page.getByRole("alert").filter({ hasText: "Todavía no confirmaste tu correo." })).toBeVisible();

    await confirm(page, account.email);
    await signIn(page, account.param, account.email);
    await expectHome(page, account);

    // Avatar menu: name and role chip, never the email.
    const trigger = page.getByRole("button", { name: `Menú de cuenta de ${account.name}` });
    await trigger.click();
    const menu = page.getByRole("menu");
    await expect(menu.getByText(account.name, { exact: true })).toBeVisible();
    await expect(menu.getByText(account.chip, { exact: true })).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveText([...account.menu]);
    await expect(page.locator("body")).not.toContainText(account.email);

    await menu.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();

    // The gated home now sends the visitor to sign in, with the role preselected.
    await page.goto(account.home);
    await expect(page).toHaveURL(new RegExp(`/login\\?role=${account.param}$`));

    await signIn(page, account.param, account.email);
    await expectHome(page, account);
  });
}

test("a PyME visiting the investor portfolio is sent to its own home", async ({ page }) => {
  const pyme = ROLES[1];
  await signUp(page, pyme);
  await expect(page.getByRole("heading", { level: 2, name: pyme.createdTitle })).toBeVisible();
  await confirm(page, pyme.email);
  await signIn(page, pyme.param, pyme.email);
  await expectHome(page, pyme);

  await page.goto("/portfolio");

  await expectHome(page, pyme);
});

test("a signed-in visitor opening the sign-in page goes to their home", async ({ page }) => {
  const investor = ROLES[0];
  await signUp(page, investor);
  await expect(page.getByRole("heading", { level: 2, name: investor.createdTitle })).toBeVisible();
  await confirm(page, investor.email);
  await signIn(page, investor.param, investor.email);
  await expectHome(page, investor);

  await page.goto("/login");

  await expectHome(page, investor);
});

test("wrong credentials are refused without signing in", async ({ page }) => {
  const investor = ROLES[0];
  await signUp(page, investor);
  await expect(page.getByRole("heading", { level: 2, name: investor.createdTitle })).toBeVisible();
  await confirm(page, investor.email);

  await signIn(page, investor.param, investor.email, "wrong-password");

  await expect(page.getByRole("alert").filter({ hasText: "Correo o contraseña incorrectos." })).toBeVisible();
  await expect(page).toHaveURL(/\/login\?role=investor$/);
  await page.goto("/portfolio");
  await expect(page).toHaveURL(/\/login\?role=investor$/);
});
