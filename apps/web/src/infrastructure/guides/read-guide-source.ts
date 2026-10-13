import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Build-time reader for `docs/guides/*.md` (Feature #497, owner decision
 * 2026-10-13, option A: the guide is read at build time, not served by the API).
 *
 * The guides live at the repository root, outside `apps/web`, so the path is
 * resolved by walking up from the process working directory until the workspace
 * manifest — never by counting `..` levels, which breaks the day the app moves.
 *
 * Server-only: the landing reads this during `next build`, so the guide is baked
 * into the prerendered page. There is no runtime filesystem dependency.
 */

const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";

/** The guide the landing's 「La traza」 section renders. */
export const HOW_IT_WORKS_GUIDE = "como-funciona-vaqcrow.md";

function repositoryRoot(from: string): string {
  let directory = from;

  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(directory, WORKSPACE_MANIFEST))) return directory;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  throw new Error(`No ${WORKSPACE_MANIFEST} above ${from}; cannot resolve docs/guides`);
}

/**
 * Reads one guide from `docs/guides/`. `fileName` is a bare file name: a value
 * with a path separator is rejected here so a caller can never walk outside the
 * guides directory.
 */
export function readGuideSource(fileName: string, from: string = process.cwd()): string {
  if (fileName.length === 0 || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new Error(`Guide name must be a bare file name, received: ${JSON.stringify(fileName)}`);
  }

  return readFileSync(join(repositoryRoot(from), "docs", "guides", fileName), "utf8");
}
