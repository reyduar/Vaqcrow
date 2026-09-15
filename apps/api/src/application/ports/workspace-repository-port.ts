export interface WorkspaceRepositoryPort {
  findByName(name: string): Promise<unknown>;
}
