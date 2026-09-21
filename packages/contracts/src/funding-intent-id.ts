import { z } from "zod";

export const fundingIntentIdSchema = z.uuidv4().brand<"FundingIntentId">();

export type FundingIntentId = z.infer<typeof fundingIntentIdSchema>;

export function parseFundingIntentId(input: unknown): FundingIntentId {
  return fundingIntentIdSchema.parse(input);
}
