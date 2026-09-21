/**
 * Converts a person-entered XLM amount into the stroop count the wire carries.
 *
 * Money crosses this boundary as a **decimal integer string**, never a number:
 * a JavaScript number is a double, and the API's contract refuses anything that
 * is not a positive decimal integer string. The conversion therefore never
 * produces one — it splits the decimal text and combines two `bigint` parts —
 * so no amount passes through a float on its way to the API.
 *
 * 1 XLM = 10,000,000 stroops, so at most 7 decimal places are representable.
 * Anything finer has no stroop equivalent and is refused rather than rounded:
 * silently dropping a digit would change the amount a person authorized.
 */

export type XlmAmountError = "invalid_format" | "too_many_decimals" | "not_positive";

export type XlmToStroopsResult =
  | { readonly ok: true; readonly stroops: string }
  | { readonly ok: false; readonly error: XlmAmountError };

const STROOPS_PER_XLM = 10_000_000n;
const MAX_DECIMALS = 7;
/** Whole part required, a single dot, and at most seven decimal digits. */
const DECIMAL_PATTERN = /^(\d+)(?:\.(\d{1,7}))?$/;

export function xlmToStroops(input: string): XlmToStroopsResult {
  const match = DECIMAL_PATTERN.exec(input.trim());

  if (!match) {
    // A decimal with more than seven places is a distinct, actionable mistake;
    // every other malformed spelling is a plain format failure.
    return { ok: false, error: /^\d+\.\d{8,}$/.test(input.trim()) ? "too_many_decimals" : "invalid_format" };
  }

  const whole = match[1] ?? "";
  const fraction = (match[2] ?? "").padEnd(MAX_DECIMALS, "0");
  const stroops = BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction);

  if (stroops <= 0n) {
    return { ok: false, error: "not_positive" };
  }

  return { ok: true, stroops: stroops.toString() };
}
