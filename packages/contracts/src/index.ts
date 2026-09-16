export interface WorkspaceProbe {
  readonly name: string;
}

export function describeWorkspace(name: string): WorkspaceProbe {
  return { name };
}

export {
  correlationIdSchema,
  generateCorrelationId,
  parseCorrelationId
} from "./correlation-id.js";
export type { CorrelationId } from "./correlation-id.js";
