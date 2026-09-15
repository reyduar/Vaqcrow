import type { AssistantPort } from "../../application/ports/assistant-port.js";

export class LlmAssistant implements AssistantPort {
  complete(): Promise<string> {
    throw new Error("not implemented");
  }
}
