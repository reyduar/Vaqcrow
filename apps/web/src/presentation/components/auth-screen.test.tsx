import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRole, SignUpOutcome } from "@/application/ports/auth-session-port";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";
import { AuthScreen } from "./auth-screen";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const EMAIL = "lucia.fernandez@example.test";
const PASSWORD = "secret-123";

function renderScreen(mode: "signup" | "login", initialRole: AccountRole = "INVERSOR", fake = new FakeAuthSession()) {
  render(
    <SessionStoreProvider port={fake}>
      <AuthScreen mode={mode} initialRole={initialRole} />
    </SessionStoreProvider>
  );
  return fake;
}

function fill(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  push.mockReset();
});

describe("AuthScreen layout", () => {
  it("renders the template's two panels in signup mode", () => {
    renderScreen("signup");

    const aside = screen.getByRole("complementary", { name: "Cómo funciona Vaqcrow" });
    expect(within(aside).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Aportá a PyMEs con la evidencia a la vista."
    );
    expect(within(aside).getAllByRole("listitem")).toHaveLength(4);
    expect(within(aside).getByText("TESTNET · Activos sin valor económico")).toBeInTheDocument();
    expect(within(aside).getByText("Firma no custodial")).toBeInTheDocument();
    expect(within(aside).getByRole("link", { name: "Vaqcrow, volver al inicio" })).toHaveAttribute("href", "/");

    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    expect(screen.getByText("TESTNET")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Tema" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Creá tu cuenta" })).toBeInTheDocument();
    expect(screen.getByText("Después vas a conectar Freighter para aportar con activos de prueba.")).toBeInTheDocument();
    expect(screen.getByText(/Tu cuenta de Vaqcrow no guarda fondos/)).toBeInTheDocument();
    expect(screen.getByText("No apto para producción.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear mi cuenta" })).toBeInTheDocument();
  });

  it("renders the canonical no-production notice whole, from its structured title and body", () => {
    renderScreen("signup");
    const lead = screen.getByText("No apto para producción.");
    expect(lead.parentElement).toHaveTextContent(
      "No apto para producción. Esta demo no constituye una oferta de inversión, recomendación financiera, aprobación regulatoria ni prueba de legalidad, rentabilidad, solvencia, custodia, calidad de proveedores u operación en Argentina."
    );
  });

  it("replaces the template's 'no real authentication' note with the Testnet note", () => {
    renderScreen("signup");
    expect(screen.getByText("Demo en Stellar Testnet: los activos no tienen valor económico.")).toBeInTheDocument();
    expect(screen.queryByText(/Sin autenticación real/)).not.toBeInTheDocument();
  });

  it("the role selector is a radio group that changes the copy", () => {
    renderScreen("signup");
    const group = screen.getByRole("radiogroup", { name: "Tipo de cuenta" });
    const investor = within(group).getByRole("radio", { name: "Soy inversor" });
    const pyme = within(group).getByRole("radio", { name: "Soy PyME" });
    expect(investor).toHaveAttribute("aria-checked", "true");
    expect(pyme).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText("Nombre completo")).toHaveAttribute("autocomplete", "name");

    fireEvent.click(pyme);

    expect(pyme).toHaveAttribute("aria-checked", "true");
    expect(investor).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Capital que se devuelve con tus ventas.");
    expect(screen.getByText("Después vas a registrar tu PyME y completar un KYC/KYB simulado.")).toBeInTheDocument();
    const name = screen.getByLabelText("Nombre o Razón Social");
    expect(name).toHaveAttribute("autocomplete", "organization");
    expect(name).toHaveAttribute("placeholder", "Ej.: Panadería La Espiga S.R.L.");
  });

  it("arrow keys move the role selection like a native radio group", () => {
    renderScreen("signup");
    const investor = screen.getByRole("radio", { name: "Soy inversor" });
    expect(investor).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Soy PyME" })).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(investor, { key: "ArrowRight" });

    const pyme = screen.getByRole("radio", { name: "Soy PyME" });
    expect(pyme).toHaveAttribute("aria-checked", "true");
    expect(pyme).toHaveFocus();
  });

  it("login mode has no name field and its own copy", () => {
    renderScreen("login", "PYME");
    expect(screen.getByRole("heading", { level: 2, name: "Ingresá a tu cuenta" })).toBeInTheDocument();
    expect(screen.getByText("Accedé a tu campaña y a tus distribuciones.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre o Razón Social")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument();
  });

  it("the switch links keep the selected role", () => {
    renderScreen("signup");
    fireEvent.click(screen.getByRole("radio", { name: "Soy PyME" }));
    expect(screen.getByText(/¿Ya tenés una cuenta\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ingresá" })).toHaveAttribute("href", "/login?role=pyme");
  });

  it("the login switch link goes back to signup with the role", () => {
    renderScreen("login");
    expect(screen.getByText(/¿No tenés cuenta\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Creá una" })).toHaveAttribute("href", "/signup?role=investor");
  });

  it("the password toggle shows and hides the password", () => {
    renderScreen("signup");
    const password = screen.getByLabelText("Contraseña");
    expect(password).toHaveAttribute("type", "password");
    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("AuthScreen validation", () => {
  it("shows no errors before the first submit", () => {
    renderScreen("signup");
    expect(screen.getByLabelText("Nombre completo")).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText("Ingresá tu nombre completo.")).not.toBeInTheDocument();
  });

  it("shows each field error after the first submit, linked to its field", async () => {
    const fake = renderScreen("signup");
    const signUp = vi.spyOn(fake, "signUp");
    fill("Nombre completo", " A ");
    fill("Correo electrónico", "lucia@example");
    fill("Contraseña", "1234567");

    submit("Crear mi cuenta");

    const name = screen.getByLabelText("Nombre completo");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Ingresá tu nombre completo.");
    const email = screen.getByLabelText("Correo electrónico");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Ingresá un correo con el formato nombre@dominio.com.");
    const password = screen.getByLabelText("Contraseña");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription("Mínimo 8 caracteres.");
    expect(name).toHaveFocus();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("an invalid email alone blocks the request and moves focus to the email field", () => {
    const fake = renderScreen("signup");
    const signUp = vi.spyOn(fake, "signUp");
    fill("Nombre completo", "Lucía Fernández");
    fill("Correo electrónico", "lucia.example.test");
    fill("Contraseña", PASSWORD);

    submit("Crear mi cuenta");

    expect(screen.getByLabelText("Nombre completo")).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("aria-invalid", "false");
    const email = screen.getByLabelText("Correo electrónico");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Ingresá un correo con el formato nombre@dominio.com.");
    expect(email).toHaveFocus();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("a short password alone blocks the request and moves focus to the password field", () => {
    const fake = renderScreen("signup", "PYME");
    const signUp = vi.spyOn(fake, "signUp");
    fill("Nombre o Razón Social", "Panadería La Espiga");
    fill("Correo electrónico", EMAIL);
    fill("Contraseña", "1234567");

    submit("Crear mi cuenta");

    expect(screen.getByLabelText("Nombre o Razón Social")).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("aria-invalid", "false");
    const password = screen.getByLabelText("Contraseña");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription("Mínimo 8 caracteres.");
    expect(password).toHaveFocus();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("validates the PyME name with its own message", () => {
    renderScreen("signup", "PYME");
    submit("Crear mi cuenta");
    expect(screen.getByLabelText("Nombre o Razón Social")).toHaveAccessibleDescription(
      "Ingresá el nombre o la razón social de tu PyME."
    );
  });
});

describe("AuthScreen signup", () => {
  function fillSignup(name = "Lucía Fernández") {
    fill(/^Nombre/, name);
    fill("Correo electrónico", EMAIL);
    fill("Contraseña", PASSWORD);
  }

  it("shows the busy state and the live region while validating", async () => {
    const fake = renderScreen("signup");
    const pending = deferred<SignUpOutcome>();
    vi.spyOn(fake, "signUp").mockReturnValue(pending.promise);
    fillSignup();

    submit("Crear mi cuenta");

    const button = await screen.findByRole("button", { name: "Validando…" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Validando tus datos. No cierres esta ventana.")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByLabelText("Correo electrónico")).toBeDisabled();

    await act(async () => {
      pending.resolve({ status: "confirmation_required" });
    });
  });

  it("sends a single request when the form is submitted again while validating", async () => {
    const fake = renderScreen("signup");
    const pending = deferred<SignUpOutcome>();
    const signUp = vi.spyOn(fake, "signUp").mockReturnValue(pending.promise);
    fillSignup();

    submit("Crear mi cuenta");
    const form = (await screen.findByRole("button", { name: "Validando…" })).closest("form");
    // A form submission (e.g. Enter) bypasses the disabled button.
    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(signUp).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve({ status: "confirmation_required" });
    });
    expect(await screen.findByRole("heading", { level: 2, name: "Conectá tu wallet" })).toBeInTheDocument();
  });

  it("sends the trimmed name, role and the login page as the confirmation target", async () => {
    const fake = renderScreen("signup", "PYME");
    const signUp = vi.spyOn(fake, "signUp");
    fillSignup("  Panadería La Espiga S.R.L.  ");

    submit("Crear mi cuenta");

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(signUp.mock.calls[0]?.[0]).toMatchObject({
      role: "PYME",
      displayName: "Panadería La Espiga S.R.L.",
      email: EMAIL,
      emailRedirectTo: `${window.location.origin}/login`
    });
  });

  it("shows the honest network error (the port cannot tell whether the request was sent)", async () => {
    const fake = renderScreen("signup");
    fake.failNext("signUp", "network");
    fillSignup();

    submit("Crear mi cuenta");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos crear la cuenta. Hubo un error de red; revisá la conexión y volvé a intentar."
    );
    expect(screen.getByRole("button", { name: "Crear mi cuenta" })).toBeEnabled();
  });

  it.each([
    ["email_taken", "No pudimos crear la cuenta. Ese correo ya tiene una cuenta: ingresá o usá otro correo."],
    ["weak_password", "No pudimos crear la cuenta. Elegí una contraseña más difícil de adivinar."],
    ["rate_limited", "No pudimos crear la cuenta. Volvé a intentar en unos minutos."]
  ] as const)("shows a sanitized message for %s", async (code, text) => {
    const fake = renderScreen("signup");
    fake.failNext("signUp", code);
    fillSignup();

    submit("Crear mi cuenta");

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it.each([
    [
      "INVERSOR",
      "Inversor",
      "Conectá tu wallet",
      ["Conectar Freighter", "Explorar PyMEs en campaña", "Leer la guía de inversión"]
    ],
    ["PYME", "PyME", "Registrá tu PyME", ["Completar KYC/KYB", "Cargar ventas mensuales", "Conectar Freighter"]]
  ] as const)("a %s signup shows the created view without the email", async (role, roleLabel, title, steps) => {
    renderScreen("signup", role);
    fillSignup();

    submit("Crear mi cuenta");

    const heading = await screen.findByRole("heading", { level: 2, name: title });
    await waitFor(() => expect(heading).toHaveFocus());
    const status = screen.getByText(/Cuenta creada\./).closest("[role='status']");
    expect(status).toHaveTextContent(
      "Cuenta creada. Confirmá tu correo desde el enlace que te enviamos para poder ingresar."
    );
    expect(status).toHaveTextContent(roleLabel);
    const items = within(screen.getByRole("list", { name: "Próximos pasos" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(
      steps.map((label) => expect.stringContaining(label) as unknown as string)
    );
    expect(document.body.innerHTML).not.toContain(EMAIL);
    expect(document.body.innerHTML).not.toContain(PASSWORD);
    expect(push).not.toHaveBeenCalled();
  });

  it("tags the PyME next steps as the template does", async () => {
    renderScreen("signup", "PYME");
    fillSignup();
    submit("Crear mi cuenta");

    const list = await screen.findByRole("list", { name: "Próximos pasos" });
    const tags = within(list)
      .getAllByRole("listitem")
      .map((item) => item.lastElementChild?.textContent);
    expect(tags).toEqual(["SIMULADO", "SIMULADO", "TESTNET"]);
  });

  it("the investor view explains Freighter signing and 'Conectar Freighter' asks to confirm first", async () => {
    renderScreen("signup");
    fillSignup();
    submit("Crear mi cuenta");

    expect(
      await screen.findByText(
        "Freighter firma cada transacción. Vaqcrow construye y verifica la transacción, y nunca recibe tu seed."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continuar con el KYC simulado/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conectar Freighter" }));

    expect(
      screen.getByText("Antes de conectar Freighter, confirmá tu cuenta con el enlace que te enviamos a tu correo.")
    ).toHaveAttribute("role", "status");
  });

  it("the PyME view follows the template and 'Continuar con el KYC simulado' asks to confirm first", async () => {
    renderScreen("signup", "PYME");
    fillSignup();
    submit("Crear mi cuenta");

    expect(
      await screen.findByText("El KYC/KYB de esta demo es simulado: no constituye una verificación de identidad.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Conectar Freighter/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar con el KYC simulado" }));

    expect(
      screen.getByText("Antes de continuar, confirmá tu cuenta con el enlace que te enviamos a tu correo.")
    ).toHaveAttribute("role", "status");
    expect(push).not.toHaveBeenCalled();
  });

  it("'Volver al formulario' returns to the form with the password cleared", async () => {
    renderScreen("signup");
    fillSignup();
    submit("Crear mi cuenta");

    fireEvent.click(await screen.findByRole("button", { name: "Volver al formulario" }));

    expect(screen.getByRole("heading", { level: 2, name: "Creá tu cuenta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("aria-invalid", "false");
  });

  it("redirects by the verified role when the provider signs in right away", async () => {
    const fake = new FakeAuthSession();
    fake.confirmSignUpsImmediately();
    renderScreen("signup", "PYME", fake);
    fillSignup();

    submit("Crear mi cuenta");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/company"));
  });

  it("gives a clear outcome when the provider signs in right away but the session read fails", async () => {
    const fake = new FakeAuthSession();
    fake.confirmSignUpsImmediately();
    renderScreen("signup", "INVERSOR", fake);
    await waitFor(() => expect(fake.listenerCount).toBe(1));
    fake.failNext("getSession", "unavailable");
    fillSignup();

    submit("Crear mi cuenta");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cuenta creada. No pudimos abrir tu sesión: ingresá con tu correo y contraseña."
    );
    expect(screen.getByRole("link", { name: "Ingresá" })).toHaveAttribute("href", "/login?role=investor");
    expect(screen.getByRole("button", { name: "Crear mi cuenta" })).toBeEnabled();
    expect(screen.queryByText(/Confirmá tu correo/)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("gives the same clear outcome when the provider signs in right away but no session is readable", async () => {
    const fake = new FakeAuthSession();
    fake.reportSignUpsAsSignedInWithoutSession();
    renderScreen("signup", "PYME", fake);
    fillSignup();

    submit("Crear mi cuenta");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cuenta creada. No pudimos abrir tu sesión: ingresá con tu correo y contraseña."
    );
    expect(screen.queryByRole("heading", { name: "Registrá tu PyME" })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("AuthScreen login", () => {
  function fillLogin(password = PASSWORD) {
    fill("Correo electrónico", EMAIL);
    fill("Contraseña", password);
  }

  it("redirects by the verified role, not by the selector", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount({ email: EMAIL, password: PASSWORD, role: "PYME", displayName: "Panadería La Espiga" });
    renderScreen("login", "INVERSOR", fake);
    expect(screen.getByRole("radio", { name: "Soy inversor" })).toHaveAttribute("aria-checked", "true");
    fillLogin();

    submit("Ingresar");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/company"));
  });

  it("sends an investor to the portfolio", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount({ email: EMAIL, password: PASSWORD, role: "INVERSOR", displayName: "Lucía Fernández" });
    renderScreen("login", "PYME", fake);
    fillLogin();

    submit("Ingresar");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/portfolio"));
  });

  it("sends an admin to the home page (the admin console is out of scope)", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount({ email: EMAIL, password: PASSWORD, role: "ADMIN", displayName: "Admin Vaqcrow" });
    renderScreen("login", "INVERSOR", fake);
    fillLogin();

    submit("Ingresar");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("shows 'Correo o contraseña incorrectos.' for wrong credentials", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount({ email: EMAIL, password: PASSWORD, role: "PYME", displayName: "Panadería La Espiga" });
    renderScreen("login", "PYME", fake);
    fillLogin("wrong-password");

    submit("Ingresar");

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(push).not.toHaveBeenCalled();
  });

  it("asks to confirm the email for an unconfirmed account", async () => {
    const fake = new FakeAuthSession();
    fake.seedAccount({ email: EMAIL, password: PASSWORD, role: "PYME", displayName: "Panadería", confirmed: false });
    renderScreen("login", "PYME", fake);
    fillLogin();

    submit("Ingresar");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Todavía no confirmaste tu correo. Revisá el enlace que te enviamos."
    );
  });

  it.each([
    ["network", "No pudimos ingresar. Hubo un error de red; revisá la conexión y volvé a intentar."],
    ["unavailable", "No pudimos ingresar. Volvé a intentar en unos minutos."]
  ] as const)("shows the %s message", async (code, text) => {
    const fake = renderScreen("login");
    fake.failNext("signIn", code);
    fillLogin();

    submit("Ingresar");

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();
  });

  it("never renders the email outside its own input", async () => {
    const fake = renderScreen("login");
    fake.failNext("signIn", "invalid_credentials");
    fillLogin();
    submit("Ingresar");
    await screen.findByRole("alert");

    const withoutInputs = document.body.cloneNode(true) as HTMLElement;
    withoutInputs.querySelectorAll("input").forEach((input) => input.remove());
    expect(withoutInputs.innerHTML).not.toContain(EMAIL);
  });
});
