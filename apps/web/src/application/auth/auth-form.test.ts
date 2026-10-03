import { describe, expect, it } from "vitest";
import {
  CREATED_ROLE_COPY,
  authErrorMessage,
  authHref,
  homeRouteFor,
  roleFromParam,
  signInRoleMismatch,
  validateAuthForm,
  type AuthFormValues
} from "./auth-form";

const VALID: AuthFormValues = { name: "Lucía Fernández", email: "lucia@example.test", password: "12345678" };

describe("roleFromParam", () => {
  it.each([
    ["pyme", "PYME"],
    ["investor", "INVERSOR"],
    [undefined, "INVERSOR"],
    ["admin", "INVERSOR"],
    [["pyme", "investor"], "PYME"]
  ] as const)("maps %j to %s", (param, role) => {
    expect(roleFromParam(param)).toBe(role);
  });
});

describe("authHref", () => {
  it("keeps the selected role in an English query parameter", () => {
    expect(authHref("login", "PYME")).toBe("/login?role=pyme");
    expect(authHref("signup", "INVERSOR")).toBe("/signup?role=investor");
  });
});

describe("homeRouteFor", () => {
  it.each([
    ["INVERSOR", "/portfolio"],
    ["PYME", "/company"],
    ["ADMIN", "/"]
  ] as const)("sends %s to %s", (role, route) => {
    expect(homeRouteFor(role)).toBe(route);
  });
});

describe("validateAuthForm", () => {
  it("accepts a complete signup", () => {
    expect(validateAuthForm("signup", "INVERSOR", VALID)).toEqual({
      valid: true,
      name: null,
      email: null,
      password: null
    });
  });

  it.each([
    ["INVERSOR", "Ingresá tu nombre completo."],
    ["PYME", "Ingresá el nombre o la razón social de tu PyME."]
  ] as const)("requires at least 2 trimmed characters of name for %s", (role, message) => {
    const result = validateAuthForm("signup", role, { ...VALID, name: "  A  " });
    expect(result).toMatchObject({ valid: false, name: message });
  });

  it("ignores the name when signing in", () => {
    expect(validateAuthForm("login", "PYME", { ...VALID, name: "" }).valid).toBe(true);
  });

  it.each(["", "lucia", "lucia@example", "lu cia@example.test"])("rejects the email %j", (email) => {
    expect(validateAuthForm("login", "INVERSOR", { ...VALID, email })).toMatchObject({
      valid: false,
      email: "Ingresá un correo con el formato nombre@dominio.com."
    });
  });

  it.each(["signup", "login"] as const)("requires 8 password characters in %s, as the template does", (mode) => {
    expect(validateAuthForm(mode, "INVERSOR", { ...VALID, password: "1234567" })).toMatchObject({
      valid: false,
      password: "Mínimo 8 caracteres."
    });
  });
});

describe("signInRoleMismatch (D14)", () => {
  function text(message: { title: string; detail?: string } | null) {
    return message ? [message.title, message.detail].filter(Boolean).join(" ") : null;
  }

  it("accepts a principal whose role matches the selected toggle", () => {
    expect(signInRoleMismatch("INVERSOR", "INVERSOR")).toBeNull();
    expect(signInRoleMismatch("PYME", "PYME")).toBeNull();
  });

  it("rejects a PyME account signed in with «Soy inversor»", () => {
    expect(text(signInRoleMismatch("INVERSOR", "PYME"))).toBe("Esta cuenta es de PyME. Elegí «Soy PyME» para ingresar.");
  });

  it("rejects an investor account signed in with «Soy PyME»", () => {
    expect(text(signInRoleMismatch("PYME", "INVERSOR"))).toBe(
      "Esta cuenta es de inversor. Elegí «Soy inversor» para ingresar."
    );
  });

  it.each(["INVERSOR", "PYME"] as const)("rejects an ADMIN with the neutral sign-in title whatever the toggle (%s)", (selected) => {
    expect(text(signInRoleMismatch(selected, "ADMIN"))).toBe("No pudimos ingresar.");
  });

  it("never names the admin role or the admin console", () => {
    expect(JSON.stringify(signInRoleMismatch("INVERSOR", "ADMIN"))).not.toMatch(/admin/i);
  });
});

describe("authErrorMessage", () => {
  it.each([
    ["invalid_credentials", "Correo o contraseña incorrectos."],
    ["invalid_input", "Correo o contraseña incorrectos."],
    ["email_not_confirmed", "Todavía no confirmaste tu correo. Revisá el enlace que te enviamos."],
    ["network", "No pudimos ingresar. Hubo un error de red; revisá la conexión y volvé a intentar."],
    ["unavailable", "No pudimos ingresar. Volvé a intentar en unos minutos."],
    ["rate_limited", "No pudimos ingresar. Volvé a intentar en unos minutos."]
  ] as const)("login %s", (code, text) => {
    const message = authErrorMessage("login", code);
    expect([message.title, message.detail].filter(Boolean).join(" ")).toBe(text);
  });

  it.each([
    // The port cannot tell whether the request reached the server, so the copy
    // never claims the data was not sent.
    ["network", "No pudimos crear la cuenta. Hubo un error de red; revisá la conexión y volvé a intentar."],
    ["email_taken", "No pudimos crear la cuenta. Ese correo ya tiene una cuenta: ingresá o usá otro correo."],
    ["weak_password", "No pudimos crear la cuenta. Elegí una contraseña más difícil de adivinar."],
    ["invalid_input", "No pudimos crear la cuenta. Revisá los datos e intentá de nuevo."],
    ["unavailable", "No pudimos crear la cuenta. Volvé a intentar en unos minutos."]
  ] as const)("signup %s", (code, text) => {
    const message = authErrorMessage("signup", code);
    expect([message.title, message.detail].filter(Boolean).join(" ")).toBe(text);
  });

  it("never claims the signup data was not sent", () => {
    expect(JSON.stringify(authErrorMessage("signup", "network"))).not.toContain("no se enviaron");
  });

  it("marks only network failures with the offline icon", () => {
    expect(authErrorMessage("signup", "network").kind).toBe("network");
    expect(authErrorMessage("login", "invalid_credentials").kind).toBe("rejected");
  });
});

describe("CREATED_ROLE_COPY", () => {
  it("keeps the template's investor post-signup view", () => {
    expect(CREATED_ROLE_COPY.INVERSOR).toEqual({
      title: "Conectá tu wallet",
      body: "Freighter firma cada transacción. Vaqcrow construye y verifica la transacción, y nunca recibe tu seed.",
      cta: "Conectar Freighter",
      confirmFirst: "Antes de conectar Freighter, confirmá tu cuenta con el enlace que te enviamos a tu correo."
    });
  });

  it("follows the template's PyME post-signup view (D8)", () => {
    expect(CREATED_ROLE_COPY.PYME).toEqual({
      title: "Registrá tu PyME",
      body: "El KYC/KYB de esta demo es simulado: no constituye una verificación de identidad.",
      cta: "Continuar con el KYC simulado",
      confirmFirst: "Antes de continuar, confirmá tu cuenta con el enlace que te enviamos a tu correo."
    });
  });
});
