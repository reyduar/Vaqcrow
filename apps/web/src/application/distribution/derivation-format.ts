const arsFormat = new Intl.NumberFormat("es-AR");

/** Whole pesos from the API's decimal string; never a `number`, so no precision is lost. */
export function formatArs(value: string): string {
  return `ARS ${arsFormat.format(BigInt(value))}`;
}

/** Integer basis points as a percentage: 450 is "4,50 %". */
export function formatRateBps(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(".", ",")} %`;
}
