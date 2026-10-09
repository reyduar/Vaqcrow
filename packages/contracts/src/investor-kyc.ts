import { z } from "zod";

/**
 * The investor's simulated KYC state (`GET`/`POST /investor-kyc`, Feature #422,
 * WU4).
 *
 * The investor's identity verification is **simulated and auto-approved at the
 * first contribution** (owner decision D2). The owner of the record is always
 * the verified principal, so no user id travels on the wire. A missing record is
 * not an error — the API answers `approved: false` with `approvedAt: null`, the
 * honest "not yet verified", never a fabricated timestamp. `simulado` is the
 * boolean the table stores (always `true` in this demo): the client labels the
 * result `SIMULADO` and never presents it as a real verification.
 */
export const investorKycSchema = z.strictObject({
  approved: z.boolean(),
  approvedAt: z.iso.datetime({ offset: true }).nullable(),
  simulado: z.boolean()
});

export type InvestorKyc = z.infer<typeof investorKycSchema>;

export function parseInvestorKyc(input: unknown): InvestorKyc {
  return investorKycSchema.parse(input);
}
