import { parseAssistantAnswerOutput, parseAssistantRouterOutput } from "@vaqcrow/contracts";
import type { AssistantAnswerOutput, AssistantRouterOutput } from "@vaqcrow/contracts";

/**
 * The model-output reader (#499/WU2).
 *
 * The assistant models are reasoners and sometimes wrap their JSON in a
 * Markdown fence or in a sentence of preamble. `extractJson` tolerates both and
 * throws when there is no usable JSON object; the two typed readers then
 * validate the object against the shared contract. Anything that throws is the
 * orchestration's signal to retry once and then answer "no documentation".
 */

const FENCE = /```[a-zA-Z0-9]*\n?([\s\S]*?)```/;

export function extractJson(raw: string): unknown {
  const text = raw.trim();
  const fenced = FENCE.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall through: the object may sit inside surrounding prose.
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(candidate.slice(start, end + 1));
  }

  throw new Error("the model output carries no JSON object");
}

export function parseRouterOutput(raw: string): AssistantRouterOutput {
  return parseAssistantRouterOutput(extractJson(raw));
}

export function parseAnswerOutput(raw: string): AssistantAnswerOutput {
  return parseAssistantAnswerOutput(extractJson(raw));
}
