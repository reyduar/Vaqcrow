/**
 * Stellar amounts are integer stroop counts (1 XLM = 10.000.000 stroops) and
 * money never becomes a `number` here: the `bigint` is split with integer
 * division and only the rendered string is fractional. This is the single
 * display formatter for the web: the retired journey's funding and
 * distribution steps once carried byte-identical private copies of it.
 * Display only; it never crosses the wire.
 */
export function formatStroopsAsXlm(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const fraction = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
}
