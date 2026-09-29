/**
 * Stellar amounts are integer stroop counts (1 XLM = 10.000.000 stroops) and
 * money never becomes a `number` here: the `bigint` is split with integer
 * division and only the rendered string is fractional. This is the single
 * display formatter for the web — `campaign-workspace` and
 * `distribution-workspace` carried byte-identical private copies of it, so the
 * definition lives here rather than a third copy in the evidence projection.
 * Display only; it never crosses the wire.
 */
export function formatStroopsAsXlm(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const fraction = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
}
