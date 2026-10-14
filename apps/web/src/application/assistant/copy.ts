import type { AssistantErrorCode } from "./assistant-port";

/**
 * The web-side copy for the help assistant (#499, WU3). Every visible string the
 * chat and its panel own lives here, so both mount points (the floating
 * assistant and `/help`) render the same words and the public-copy denylist can
 * scan them.
 *
 * The four fixed answers (out-of-scope, no-documentation, account and cap) are
 * NOT here: the API returns them as ordinary 200 answers and the chat renders
 * them verbatim. These are the chrome labels, the two failure texts and one
 * access string.
 *
 * `forbidden` is the one copy that is not in owner decision D8: the API answers
 * `403` when the per-user assistant flag is off (D9), and the chat states that
 * honestly instead of inventing a service failure.
 */
export const ASSISTANT_COPY = {
  title: "Asistente de Vaqcrow",
  subtitle: "Respuestas de la documentación",
  greeting: "Hola. Preguntá sobre Vaqcrow: qué es, cómo funciona y su tecnología.",
  inputLabel: "Escribí tu pregunta",
  placeholder: "Escribir pregunta",
  send: "Enviar",
  sending: "Enviando…",
  citationsLabel: "Fuentes",
  you: "Tu pregunta",
  empty: "Todavía no hay preguntas.",
  errors: {
    // Not in the approved D8 list: the per-user flag (D9) is off for this account.
    forbidden: "El asistente todavía no está habilitado para tu cuenta.",
    unavailable: "No pudimos responder ahora. Probá de nuevo en un rato.",
    network: "No pudimos contactar al servidor. Probá de nuevo.",
    not_configured: "Esta instancia no tiene configurada la API."
  } satisfies Readonly<Record<AssistantErrorCode, string>>
} as const;

/** The Spanish text for a sanitized failure code; the code never reaches the DOM. */
export function assistantErrorCopy(code: AssistantErrorCode): string {
  return ASSISTANT_COPY.errors[code];
}
