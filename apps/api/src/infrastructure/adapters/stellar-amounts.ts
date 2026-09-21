/**
 * Converts a Stellar decimal amount — the string form Horizon and XDR use —
 * into stroops, without ever going through a float.
 *
 * Money is integer-only in this codebase: 1 XLM = 10,000,000 stroops. Parsing
 * through `Number` would silently round balances beyond 2^53 stroops, so the
 * digits are reassembled as text and parsed once with `BigInt`.
 */
const STROOPS_DECIMALS = 7;
const STROOPS_PER_UNIT = 10n ** BigInt(STROOPS_DECIMALS);

const DECIMAL_AMOUNT = /^(-?)(\d+)(?:\.(\d*))?$/;

export function xlmToStroops(amount: string): bigint {
  const parsed = DECIMAL_AMOUNT.exec(amount.trim());

  if (parsed === null) {
    throw new Error(`Malformed Stellar amount: ${amount}`);
  }

  const [, sign = "", whole = "0", fraction = ""] = parsed;

  if (fraction.length > STROOPS_DECIMALS) {
    throw new Error(`Stellar amounts carry at most ${STROOPS_DECIMALS} decimals: ${amount}`);
  }

  const stroops =
    BigInt(whole) * STROOPS_PER_UNIT + BigInt(fraction.padEnd(STROOPS_DECIMALS, "0"));

  return sign === "-" ? -stroops : stroops;
}

/**
 * Converts a stroop count into the decimal amount string the XDR carries — the
 * inverse of {@link xlmToStroops}, and equally float-free.
 *
 * The result always carries the full seven decimals (`"10.0000000"`), which is
 * the canonical form `Operation.payment` accepts and the form
 * `xlmToStroops` round-trips. Whole and fractional parts are split with
 * `BigInt` division and remainder, so no magnitude loses precision.
 */
export function stroopsToXlm(stroops: bigint): string {
  const negative = stroops < 0n;
  const absolute = negative ? -stroops : stroops;
  const whole = absolute / STROOPS_PER_UNIT;
  const fraction = (absolute % STROOPS_PER_UNIT).toString().padStart(STROOPS_DECIMALS, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}
