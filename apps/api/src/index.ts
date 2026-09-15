import { describeWorkspace } from "@vaqcrow/contracts";
import { isWorkspaceBootstrapped } from "@vaqcrow/domain";

export function apiBootstrapProbe(): string {
  const probe = describeWorkspace("api");
  return isWorkspaceBootstrapped([probe.name]) ? `${probe.name}:ready` : `${probe.name}:empty`;
}
