/**
 * The fixed assistant answers (#499/WU2, owner decision D8, verbatim).
 *
 * These are the only strings the assistant says that are **not** produced by
 * the model: the out-of-scope decline, the no-documentation answer, the account
 * pointer and the rate-limit suggestion (which never names the limit). The
 * anonymous hint is the web's, kept here so the copy has a single home.
 */

/** Out of scope: the question is not about Vaqcrow. */
export const ASSISTANT_OUT_OF_SCOPE_COPY =
  "Puedo ayudarte solo con Vaqcrow: qué es, cómo funciona y su tecnología. Para otros temas no soy de utilidad.";

/** No page covers the question (also the end of a failed retry). */
export const ASSISTANT_NO_DOCUMENTATION_COPY =
  "No tengo documentación sobre eso. Podés leer las guías y el Blog, o escribir a soporte.";

/** An account question (D3): point to the reports, then to support. */
export const ASSISTANT_ACCOUNT_COPY =
  "La información de tu cuenta está en tus informes. Si no lo encontrás ahí, escribí a soporte.";

/** Over the rolling cap (D6): suggest the Blog, never mention the limit. */
export const ASSISTANT_CAP_COPY =
  "Te sugiero leer los artículos del Blog: ahí cubrimos Vaqcrow con más detalle.";

/** Shown to an anonymous visitor by the web (D8). */
export const ASSISTANT_ANONYMOUS_HINT = "Iniciá sesión para preguntarle al asistente.";
