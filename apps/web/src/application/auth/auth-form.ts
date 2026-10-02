import type { AccountRole, AuthErrorCode, PrincipalRole } from "@/application/ports/auth-session-port";
import { DISPLAY_NAME_MIN_LENGTH } from "./sign-up-input";

/**
 * Pure model of the `/signup` and `/login` screen (`Vaqcrow Onboarding.dc.html`,
 * one screen with two modes). React-free: the presentation layer renders it.
 *
 * Copy is verbatim from the template's logic block except the owner overrides
 * recorded in `odd/tasks/account-creation-sign-in-role-shell.md` (D5/D7) and
 * the strings that log lists as assumptions for the owner.
 */
export type AuthMode = "signup" | "login";

/** English query values for the role selector (`?role=investor|pyme`). */
export type RoleParam = "investor" | "pyme";

const ROLE_TO_PARAM: Readonly<Record<AccountRole, RoleParam>> = { INVERSOR: "investor", PYME: "pyme" };

/** The template's default role is the investor; unknown values fall back to it. */
export function roleFromParam(param: string | readonly string[] | undefined): AccountRole {
  const value = Array.isArray(param) ? param[0] : param;
  return value === "pyme" ? "PYME" : "INVERSOR";
}

export function authHref(mode: AuthMode, role: AccountRole): string {
  return `/${mode}?role=${ROLE_TO_PARAM[role]}`;
}

/**
 * Where a verified principal lands after signing in (D2). The role comes from
 * the session port, never from the selector. `ADMIN` goes to `/` until the
 * admin console exists.
 */
export function homeRouteFor(role: PrincipalRole): "/portfolio" | "/company" | "/" {
  if (role === "INVERSOR") return "/portfolio";
  if (role === "PYME") return "/company";
  return "/";
}

export interface AuthFormValues {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

export interface AuthFormValidation {
  readonly valid: boolean;
  readonly name: string | null;
  readonly email: string | null;
  readonly password: string | null;
}

/** The template's own shape check (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;

export const FIELD_COPY = {
  emailLabel: "Correo electrónico",
  emailPlaceholder: "nombre@ejemplo.com",
  emailError: "Ingresá un correo con el formato nombre@dominio.com.",
  passwordLabel: "Contraseña",
  passwordHelp: "Mínimo 8 caracteres.",
  showPassword: "Mostrar contraseña",
  hidePassword: "Ocultar contraseña"
} as const;

export interface RoleCopy {
  readonly selectorLabel: string;
  readonly heroTitle: string;
  readonly heroBody: string;
  readonly signupSubtitle: string;
  readonly loginSubtitle: string;
  readonly nameLabel: string;
  readonly namePlaceholder: string;
  readonly nameAutocomplete: "name" | "organization";
  readonly nameError: string;
  /** Role label shown in the "Cuenta creada" banner. */
  readonly createdLabel: string;
  readonly nextSteps: readonly { readonly icon: NextStepIcon; readonly label: string; readonly tag: string }[];
}

export type NextStepIcon = "document" | "chart" | "wallet" | "search" | "book";

export const ROLE_COPY: Readonly<Record<AccountRole, RoleCopy>> = {
  INVERSOR: {
    selectorLabel: "Soy inversor",
    heroTitle: "Aportá a PyMEs con la evidencia a la vista.",
    heroBody:
      "Revenue share sobre ventas verificables, con cada aporte custodiado por un contrato en Stellar. Esta es una demo en Testnet.",
    signupSubtitle: "Después vas a conectar Freighter para aportar con activos de prueba.",
    loginSubtitle: "Accedé a tu portafolio y a tus aportes en Testnet.",
    nameLabel: "Nombre completo",
    namePlaceholder: "Ej.: Lucía Fernández",
    nameAutocomplete: "name",
    nameError: "Ingresá tu nombre completo.",
    createdLabel: "Inversor",
    nextSteps: [
      { icon: "wallet", label: "Conectar Freighter", tag: "TESTNET" },
      { icon: "search", label: "Explorar PyMEs en campaña", tag: "" },
      { icon: "book", label: "Leer la guía de inversión", tag: "" }
    ]
  },
  PYME: {
    selectorLabel: "Soy PyME",
    heroTitle: "Capital que se devuelve con tus ventas.",
    heroBody:
      "Financiamiento por revenue share para PyMEs formales. Devolvés una participación de tus ingresos, no una cuota fija.",
    signupSubtitle: "Después vas a registrar tu PyME y completar un KYC/KYB simulado.",
    loginSubtitle: "Accedé a tu campaña y a tus distribuciones.",
    nameLabel: "Nombre o Razón Social",
    namePlaceholder: "Ej.: Panadería La Espiga S.R.L.",
    nameAutocomplete: "organization",
    nameError: "Ingresá el nombre o la razón social de tu PyME.",
    createdLabel: "PyME",
    nextSteps: [
      { icon: "document", label: "Completar KYC/KYB", tag: "SIMULADO" },
      { icon: "chart", label: "Cargar ventas mensuales", tag: "SIMULADO" },
      { icon: "wallet", label: "Conectar Freighter", tag: "TESTNET" }
    ]
  }
};

export const MODE_COPY: Readonly<
  Record<AuthMode, { title: string; submit: string; switchPrompt: string; switchLabel: string }>
> = {
  signup: { title: "Creá tu cuenta", submit: "Crear mi cuenta", switchPrompt: "¿Ya tenés una cuenta?", switchLabel: "Ingresá" },
  login: { title: "Ingresá a tu cuenta", submit: "Ingresar", switchPrompt: "¿No tenés cuenta?", switchLabel: "Creá una" }
};

export const SCREEN_COPY = {
  asideLabel: "Cómo funciona Vaqcrow",
  homeLinkLabel: "Vaqcrow, volver al inicio",
  backHome: "Volver al inicio",
  roleGroupLabel: "Tipo de cuenta",
  modelSteps: [
    { n: "01", title: "La PyME presenta evidencia.", body: "Perfil, KYC y ventas, con su origen declarado." },
    { n: "02", title: "La IA ordena; una persona decide.", body: "La aprobación siempre tiene autor y fecha." },
    { n: "03", title: "Los aportes van a una bóveda.", body: "Un contrato de Stellar los custodia hasta la meta." },
    { n: "04", title: "Se distribuye sobre las ventas.", body: "Cálculo determinístico, firmado en Freighter." }
  ],
  custodyNote:
    "Tu cuenta de Vaqcrow no guarda fondos. Los aportes los custodia el contrato de cada bóveda, y cada transacción la firmás vos con Freighter; Vaqcrow nunca recibe tu seed.",
  busyLabel: "Validando…",
  busyLive: "Validando tus datos. No cierres esta ventana.",
  /** Owner override (D5) of the template's "Sin autenticación real: es una cuenta de demostración." */
  idleLive: "Demo en Stellar Testnet: los activos no tienen valor económico."
} as const;

/** The "Cuenta creada" view (template phase `created`, owner override D7). */
export const CREATED_COPY = {
  bannerTitle: "Cuenta creada.",
  bannerBody: "Confirmá tu correo desde el enlace que te enviamos para poder ingresar.",
  title: "Conectá tu wallet",
  body: "Freighter firma cada transacción. Vaqcrow construye y verifica la transacción, y nunca recibe tu seed.",
  stepsLabel: "Próximos pasos",
  connect: "Conectar Freighter",
  back: "Volver al formulario",
  confirmFirst: "Antes de conectar Freighter, confirmá tu cuenta con el enlace que te enviamos a tu correo."
} as const;

export function validateAuthForm(mode: AuthMode, role: AccountRole, values: AuthFormValues): AuthFormValidation {
  const name =
    mode === "signup" && values.name.trim().length < DISPLAY_NAME_MIN_LENGTH ? ROLE_COPY[role].nameError : null;
  const email = EMAIL_PATTERN.test(values.email) ? null : FIELD_COPY.emailError;
  const password = values.password.length >= PASSWORD_MIN_LENGTH ? null : FIELD_COPY.passwordHelp;
  return { valid: name === null && email === null && password === null, name, email, password };
}

export interface AuthErrorMessage {
  /** `network` renders the template's offline icon; `rejected` an alert icon. */
  readonly kind: "network" | "rejected";
  readonly title: string;
  readonly detail?: string;
}

const SIGNUP_TITLE = "No pudimos crear la cuenta.";
const LOGIN_TITLE = "No pudimos ingresar.";
const RETRY_LATER = "Volvé a intentar en unos minutos.";

/**
 * Sanitized copy per error code; provider messages never reach the screen.
 * Strings beyond the template and D5 are owner assumptions recorded in the log.
 */
export function authErrorMessage(mode: AuthMode, code: AuthErrorCode): AuthErrorMessage {
  if (mode === "login") {
    switch (code) {
      case "invalid_credentials":
      case "invalid_input":
        return { kind: "rejected", title: "Correo o contraseña incorrectos." };
      case "email_not_confirmed":
        return {
          kind: "rejected",
          title: "Todavía no confirmaste tu correo.",
          detail: "Revisá el enlace que te enviamos."
        };
      case "network":
        return {
          kind: "network",
          title: LOGIN_TITLE,
          detail: "Hubo un error de red; revisá la conexión y volvé a intentar."
        };
      default:
        return { kind: "rejected", title: LOGIN_TITLE, detail: RETRY_LATER };
    }
  }
  switch (code) {
    case "network":
      return {
        kind: "network",
        title: SIGNUP_TITLE,
        detail: "Hubo un error de red; tus datos no se enviaron. Revisá la conexión y volvé a intentar."
      };
    case "email_taken":
      return { kind: "rejected", title: SIGNUP_TITLE, detail: "Ese correo ya tiene una cuenta: ingresá o usá otro correo." };
    case "weak_password":
      return { kind: "rejected", title: SIGNUP_TITLE, detail: "Elegí una contraseña más difícil de adivinar." };
    case "invalid_input":
      return { kind: "rejected", title: SIGNUP_TITLE, detail: "Revisá los datos e intentá de nuevo." };
    default:
      return { kind: "rejected", title: SIGNUP_TITLE, detail: RETRY_LATER };
  }
}
