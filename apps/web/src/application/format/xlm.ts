/**
 * The single XLM display formatter for the web (#572): `es-AR` with exactly 2
 * fraction digits, e.g. `10.000,12 XLM`. Every screen that shows an XLM amount
 * (wallet balance, portfolio, PyME dashboard, reports, admin evidence) reads it
 * through here. The API keeps sending the canonical 7-decimal string; only the
 * rendering rounds.
 *
 * The signing review is the exception: what the person is about to sign in
 * Freighter is shown exactly through `formatStroopsAsXlm` (`./stroops`), never
 * rounded by this module. Display only; it never performs money arithmetic.
 */

const XLM_FORMATTER = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/** Canonical XLM -> `1.250,50` (no unit); a non-numeric input is returned unchanged. */
export function formatXlmValue(xlm: string): string {
  const value = Number(xlm);
  return Number.isFinite(value) ? XLM_FORMATTER.format(value) : xlm;
}

/** Canonical XLM -> `1.250,50 XLM`; a non-numeric input is returned unchanged. */
export function formatXlmAmount(xlm: string): string {
  const value = Number(xlm);
  return Number.isFinite(value) ? `${XLM_FORMATTER.format(value)} XLM` : xlm;
}
