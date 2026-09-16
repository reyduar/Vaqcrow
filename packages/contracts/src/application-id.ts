import { z } from "zod";

export const applicationIdSchema = z.uuidv4().brand<"ApplicationId">();

export type ApplicationId = z.infer<typeof applicationIdSchema>;

export function parseApplicationId(input: unknown): ApplicationId {
  return applicationIdSchema.parse(input);
}
