import { describeWorkspace } from "@vaqcrow/contracts";

export function webBootstrapProbe(): string {
  return `${describeWorkspace("web").name}:ready`;
}
