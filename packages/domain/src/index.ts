export function isWorkspaceBootstrapped(packages: readonly string[]): boolean {
  return packages.length > 0;
}
