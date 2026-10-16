/**
 * `/account-confirmed`: where the sign-up confirmation email lands (#556).
 * The template does not design this page; the copy follows the owner's
 * wording from the second manual test (2026-10-15).
 */
export const ACCOUNT_CONFIRMED_PATH = "/account-confirmed";

export interface AccountConfirmedCopy {
  readonly title: string;
  readonly body: string;
}

export const ACCOUNT_CONFIRMED_COPY = {
  confirmed: {
    title: "Tu cuenta fue confirmada con éxito",
    body: "Gracias por registrarte en Vaqcrow. Ya podés ingresar con tu correo y tu contraseña."
  },
  failed: {
    title: "No pudimos confirmar tu cuenta",
    body: "El enlace venció o ya se usó. Probá ingresar; si tu cuenta todavía no está confirmada, volvé a crearla con el mismo correo y te enviamos un enlace nuevo."
  },
  login: "Ir a ingresar"
} as const satisfies {
  readonly confirmed: AccountConfirmedCopy;
  readonly failed: AccountConfirmedCopy;
  readonly login: string;
};

/**
 * Supabase Auth redirects a failed confirmation (expired or reused link) to
 * the same target with `error`/`error_code` in the query, so the page must not
 * claim success then. Any other query (the PKCE `code`) is a confirmed link.
 */
export function confirmationFailed(params: Readonly<Record<string, string | string[] | undefined>>): boolean {
  return params.error !== undefined || params.error_code !== undefined;
}
