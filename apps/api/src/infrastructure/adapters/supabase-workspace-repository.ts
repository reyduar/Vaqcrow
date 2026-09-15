import type { WorkspaceRepositoryPort } from "../../application/ports/workspace-repository-port.js";

export class SupabaseWorkspaceRepository implements WorkspaceRepositoryPort {
  findByName(): Promise<unknown> {
    throw new Error("not implemented");
  }
}
