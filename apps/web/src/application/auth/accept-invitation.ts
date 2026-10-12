import type { AuthErrorCode } from "@/application/ports/auth-session-port";
import type { OperatorInvitationErrorCode } from "@/application/ports/operator-invitation-port";
import { DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MIN_LENGTH } from "./sign-up-input";

/**
 * Pure model of the operator invitation acceptance (#390/WU5). React-free: the
 * presentation layer renders it.
 *
 * The invited operator arrives from the GoTrue invite email, which lands on
 * `ACCEPT_INVITATION_PATH` (the invite's `redirectTo`, exact match) and
 * establishes their session. Here they set their full name and — over the
 * Supabase browser client, not the API — their password. Copy is Spanish, per
 * the app's UI language; the route path stays English.
 */

/** The invite email's redirect target (owner decision, exact match). */
export const ACCEPT_INVITATION_PATH = "/accept-invitation";

export const ACCEPT_COPY = {
  title: "Activá tu cuenta de operador",
  subtitle: "Elegí tu nombre y una contraseña para entrar al panel de administración.",
  nameLabel: "Nombre completo",
  namePlaceholder: "Ej.: Ana Operadora",
  nameError: "Ingresá tu nombre completo.",
  passwordLabel: "Contraseña",
  passwordHelp: "Mínimo 8 caracteres.",
  passwordError: "Elegí una contraseña de al menos 8 caracteres.",
  confirmLabel: "Repetí la contraseña",
  confirmMismatch: "Las contraseñas no coinciden.",
  submit: "Activar mi cuenta",
  busy: "Activando tu cuenta…",
  busyLive: "Estamos guardando tus datos. No cierres esta ventana.",
  /** Shown when the password was saved but the display-name call failed. */
  passwordSavedNote: "Tu contraseña ya quedó guardada; solo falta tu nombre."
} as const;

/** Shown while the session (from the invite link) is still being read. */
export const LOADING_COPY = "Comprobando tu invitación…";

/**
 * The invitee holds no usable session: the link expired, was already used, or
 * was opened in a browser that never exchanged it. Never fake success.
 */
export const MISSING_SESSION_COPY = {
  title: "Tu invitación no está activa",
  detail:
    "El enlace puede haber vencido o haberse usado ya. Pedile a un administrador que te envíe una invitación nueva.",
  cta: "Ir a ingresar"
} as const;

export interface AcceptInvitationFormValues {
  readonly displayName: string;
  readonly password: string;
  readonly confirmPassword: string;
}

export interface AcceptInvitationValidation {
  readonly valid: boolean;
  readonly displayName: string | null;
  readonly password: string | null;
  readonly confirmPassword: string | null;
}

/**
 * Validates the acceptance form. The display-name rule mirrors the signup
 * trigger (2–120 after trim); the password rule matches the signup screen's
 * 8-character minimum; the confirmation must match exactly.
 */
export function validateAcceptInvitationForm(values: AcceptInvitationFormValues): AcceptInvitationValidation {
  const name = values.displayName.trim();
  const displayName =
    name.length < DISPLAY_NAME_MIN_LENGTH || name.length > DISPLAY_NAME_MAX_LENGTH ? ACCEPT_COPY.nameError : null;
  const password = values.password.length < 8 ? ACCEPT_COPY.passwordError : null;
  const confirmPassword = values.password === values.confirmPassword ? null : ACCEPT_COPY.confirmMismatch;
  return {
    valid: displayName === null && password === null && confirmPassword === null,
    displayName,
    password,
    confirmPassword
  };
}

export interface AcceptInvitationErrorMessage {
  /** `network` renders the offline icon; `rejected` an alert icon. */
  readonly kind: "network" | "rejected";
  readonly title: string;
  readonly detail?: string;
}

const RETRY_LATER = "Volvé a intentar en unos minutos.";

/**
 * Sanitized copy for the client-side password step. Provider messages never
 * reach the screen; only the closed code does.
 */
export function credentialErrorMessage(code: AuthErrorCode): AcceptInvitationErrorMessage {
  switch (code) {
    case "weak_password":
      return {
        kind: "rejected",
        title: "No pudimos guardar tu contraseña.",
        detail: "Elegí una contraseña más difícil de adivinar."
      };
    case "invalid_input":
      return {
        kind: "rejected",
        title: "No pudimos guardar tu contraseña.",
        detail: "La contraseña no cumple los requisitos."
      };
    case "network":
      return {
        kind: "network",
        title: "No pudimos guardar tu contraseña.",
        detail: "Hubo un error de red; revisá la conexión y volvé a intentar."
      };
    case "rate_limited":
      return {
        kind: "rejected",
        title: "No pudimos guardar tu contraseña.",
        detail: "Demasiados intentos. Esperá un momento y volvé a intentar."
      };
    default:
      return { kind: "rejected", title: "No pudimos guardar tu contraseña.", detail: RETRY_LATER };
  }
}

/**
 * Sanitized copy for the display-name API step. The API's envelope `message`
 * never reaches the screen.
 */
export function gatewayErrorMessage(code: OperatorInvitationErrorCode): AcceptInvitationErrorMessage {
  switch (code) {
    case "unauthenticated":
      return {
        kind: "rejected",
        title: "Tu sesión venció.",
        detail: "Volvé a abrir el enlace de la invitación para continuar."
      };
    case "not_found":
      return {
        kind: "rejected",
        title: "No encontramos tu cuenta.",
        detail: "Pedile a un administrador que te envíe una invitación nueva."
      };
    case "invalid_request":
      return {
        kind: "rejected",
        title: "No pudimos guardar tu nombre.",
        detail: "Revisá el nombre e intentá de nuevo."
      };
    case "network":
      return {
        kind: "network",
        title: "No pudimos guardar tu nombre.",
        detail: "Hubo un error de red; revisá la conexión y volvé a intentar."
      };
    default:
      return { kind: "rejected", title: "No pudimos guardar tu nombre.", detail: RETRY_LATER };
  }
}
