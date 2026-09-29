import { z } from "zod";

export const revenueShareDistributionIdSchema = z.uuidv4().brand<"RevenueShareDistributionId">();

export type RevenueShareDistributionId = z.infer<typeof revenueShareDistributionIdSchema>;

export function parseRevenueShareDistributionId(input: unknown): RevenueShareDistributionId {
  return revenueShareDistributionIdSchema.parse(input);
}
