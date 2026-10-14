/**
 * Static copy of the Blog pages and the «Acerca de» section (Feature #498, WU3).
 * React-free so the components share one source and the prohibited-terms scan
 * can read every visible string. UI copy is Spanish; the routes stay English
 * (`/blog`, `/blog/[slug]`).
 *
 * The article body is runtime content served by the API and lives in the
 * repository, not here — this module holds only the labels and headings the
 * components render around it.
 */
export const BLOG_COPY = Object.freeze({
  list: Object.freeze({
    headingId: "blog-page-title",
    eyebrow: "Blog",
    title: "Blog",
    subtitle: "Artículos sobre el producto, la tecnología y cómo funciona Vaqcrow.",
    note: "Publicamos análisis y guías sobre financiamiento PyME, Stellar y la operación de la demo.",
    loading: "Cargando artículos",
    emptyTitle: "Todavía no hay artículos publicados",
    emptyBody: "Cuando publiquemos el primero, va a aparecer acá.",
    errorTitle: "No pudimos cargar el blog",
    errorMessage: "El servicio no respondió. Ningún dato se modificó.",
    retry: "Reintentar",
    /** D6: the only visible date metadata is the publication date. */
    publishedLabel: "Publicado el"
  }),
  article: Object.freeze({
    eyebrow: "Blog",
    backToList: "Volver al blog",
    loading: "Cargando artículo",
    errorTitle: "No pudimos cargar el artículo",
    errorMessage: "El servicio no respondió. Ningún dato se modificó.",
    retry: "Reintentar",
    notFoundTitle: "No encontramos este artículo",
    notFoundBody: "Puede que no esté publicado o que el enlace ya no sea válido.",
    notFoundCta: "Volver al blog",
    /** D6: the only visible date metadata is the publication date. */
    publishedLabel: "Publicado el",
    /** Front-matter tags, not a byline (D6). */
    tagsLabel: "Temas"
  })
});
