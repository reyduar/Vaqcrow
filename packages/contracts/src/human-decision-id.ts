import { z } from "zod";

export const humanDecisionIdSchema = z.uuidv4().brand<"HumanDecisionId">();

export type HumanDecisionId = z.infer<typeof humanDecisionIdSchema>;

export function parseHumanDecisionId(input: unknown): HumanDecisionId {
  return humanDecisionIdSchema.parse(input);
}
