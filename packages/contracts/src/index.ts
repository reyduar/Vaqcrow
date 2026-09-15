export interface WorkspaceProbe {
  readonly name: string;
}

export function describeWorkspace(name: string): WorkspaceProbe {
  return { name };
}
