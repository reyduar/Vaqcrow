export interface AssistantPort {
  complete(prompt: string): Promise<string>;
}
