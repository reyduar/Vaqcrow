/**
 * es-AR display formatting for the Blog (Feature #498, WU3). React-free and
 * `Intl`-based; the only visible date is the article's `published_at` (D6), so
 * there is no author or byline formatting here.
 */

const PUBLISH_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

/** `"2026-10-14T12:00:00.000Z"` → `"14/10/2026"`; an invalid date is the empty string. */
export function formatPublishedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return PUBLISH_DATE_FORMATTER.format(date);
}
