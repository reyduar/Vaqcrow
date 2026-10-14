import { z } from "zod";

/**
 * The help assistant contracts (#499/WU2).
 *
 * The assistant answers only from a compiled wiki (Karpathy's LLM-Wiki method,
 * no embeddings) and runs on the OpenCode Go models the assessment already uses.
 * These schemas are the wire shape `apps/web` consumes and the shape the model
 * output is validated against; both are strict, so a body can never smuggle an
 * identity past the route and the orchestration never has to guess at a field.
 */

/**
 * The question a signed-in user asks. Untrusted input: the route trims it,
 * bounds it and never echoes it back unparsed.
 */
export const assistantQuestionCommandSchema = z.strictObject({
  question: z.string().trim().min(1).max(2000)
});

export type AssistantQuestionCommand = z.infer<typeof assistantQuestionCommandSchema>;

/**
 * A wiki page id: the URL segment, the file name without `.md`, and the slug
 * `docs/wiki/schema.md` fixes. The same shape the router is asked to return, so
 * a well-formed id is the only one that can select a page.
 */
export const assistantPageIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export type AssistantPageId = z.infer<typeof assistantPageIdSchema>;

/**
 * A citation on the wire: the page it came from, its title, and the app screen
 * it links to (owner decision D10) — `null` for a page that declares no screen.
 */
export const assistantCitationSchema = z.strictObject({
  id: assistantPageIdSchema,
  title: z.string().trim().min(1),
  screen: z.string().trim().min(1).nullable()
});

export type AssistantCitation = z.infer<typeof assistantCitationSchema>;

/**
 * `POST /assistant/questions` response. Every path — a grounded answer, the
 * out-of-scope decline, the fixed no-documentation answer, the account pointer
 * and the rate-limit suggestion — is one of these: a short Spanish answer and
 * the pages it cites (empty for a fixed answer).
 */
export const assistantAnswerSchema = z.strictObject({
  answer: z.string().trim().min(1),
  citations: z.array(assistantCitationSchema)
});

export type AssistantAnswer = z.infer<typeof assistantAnswerSchema>;

/**
 * The router model's structured output. `account` is a third scope (owner
 * decision D3): a question about the user's own data is answered with the fixed
 * account copy, pointing to the reports and then to support.
 */
export const assistantScopeSchema = z.enum(["in", "out", "account"]);

export type AssistantScope = z.infer<typeof assistantScopeSchema>;

export const assistantRouterOutputSchema = z.strictObject({
  scope: assistantScopeSchema,
  pages: z.array(z.string())
});

export type AssistantRouterOutput = z.infer<typeof assistantRouterOutputSchema>;

/** The answer model's structured output: the answer and the page ids it used. */
export const assistantAnswerOutputSchema = z.strictObject({
  answer: z.string().trim().min(1),
  citations: z.array(z.string())
});

export type AssistantAnswerOutput = z.infer<typeof assistantAnswerOutputSchema>;

/** The admin per-user access toggle (owner decision D9; off by default). */
export const setChatAccessCommandSchema = z.strictObject({
  enabled: z.boolean()
});

export type SetChatAccessCommand = z.infer<typeof setChatAccessCommandSchema>;

export const setChatAccessResultSchema = z.strictObject({
  userId: z.string().min(1),
  enabled: z.boolean()
});

export type SetChatAccessResult = z.infer<typeof setChatAccessResultSchema>;

export function parseAssistantQuestionCommand(input: unknown): AssistantQuestionCommand {
  return assistantQuestionCommandSchema.parse(input);
}

export function parseAssistantAnswer(input: unknown): AssistantAnswer {
  return assistantAnswerSchema.parse(input);
}

export function parseAssistantRouterOutput(input: unknown): AssistantRouterOutput {
  return assistantRouterOutputSchema.parse(input);
}

export function parseAssistantAnswerOutput(input: unknown): AssistantAnswerOutput {
  return assistantAnswerOutputSchema.parse(input);
}

export function parseSetChatAccessCommand(input: unknown): SetChatAccessCommand {
  return setChatAccessCommandSchema.parse(input);
}

export function parseSetChatAccessResult(input: unknown): SetChatAccessResult {
  return setChatAccessResultSchema.parse(input);
}
