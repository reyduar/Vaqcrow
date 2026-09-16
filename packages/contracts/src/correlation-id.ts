import { z } from "zod";

export const correlationIdSchema = z.uuidv4().brand<"CorrelationId">();

export type CorrelationId = z.infer<typeof correlationIdSchema>;

export function parseCorrelationId(input: unknown): CorrelationId {
  return correlationIdSchema.parse(input);
}

export function generateCorrelationId(): CorrelationId {
  const crypto = Reflect.get(globalThis, "crypto") as { randomUUID(): string };
  return parseCorrelationId(crypto.randomUUID());
}
