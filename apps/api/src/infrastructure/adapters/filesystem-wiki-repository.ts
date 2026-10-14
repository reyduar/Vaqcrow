import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import type { WikiRepositoryPort, WikiRepositoryResult } from "../../application/ports/wiki-repository-port.js";

/**
 * The filesystem wiki repository (#499/WU2, owner decision D2).
 *
 * The API reads the compiled wiki: `docs/wiki/` is bundled into the API image
 * and read at runtime. A **page id** comes from the router — model output, and
 * therefore hostile — so before any read it must be a slug and must resolve
 * inside the wiki root; a refused id is `value: undefined` and never touches the
 * filesystem. A missing file is also `value: undefined`; any other I/O error is
 * a sanitized `unavailable`.
 */

const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";
const MAX_DEPTH = 10;
const INDEX_FILE = "index.md";
const PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Walks up from `cwd` until the workspace manifest, then returns that root's
 * `docs/wiki` directory. Resolving by the manifest — never by counting `..`
 * levels — keeps the path correct wherever the app runs (a container, a
 * worktree, a nested package).
 */
export function resolveWikiRoot(cwd: string = process.cwd()): string {
  let directory = cwd;

  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (existsSync(join(directory, WORKSPACE_MANIFEST))) return join(directory, "docs", "wiki");
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  throw new Error(`No ${WORKSPACE_MANIFEST} above ${cwd}; cannot resolve docs/wiki`);
}

export class FileSystemWikiRepository implements WikiRepositoryPort {
  private readonly root: string;

  constructor(options: { readonly wikiRoot: string }) {
    this.root = resolve(options.wikiRoot);
  }

  async readIndex(): Promise<WikiRepositoryResult<string | undefined>> {
    return this.readFile(INDEX_FILE);
  }

  async readPage(id: string): Promise<WikiRepositoryResult<string | undefined>> {
    // The router's id is model output: only a slug may become a file name.
    if (!PAGE_SLUG.test(id)) return { ok: true, value: undefined };
    return this.readFile(`${id}.md`);
  }

  private async readFile(relativePath: string): Promise<WikiRepositoryResult<string | undefined>> {
    const target = this.resolveInsideRoot(relativePath);
    if (target === undefined) return { ok: true, value: undefined };

    try {
      return { ok: true, value: await readFile(target, "utf8") };
    } catch (error) {
      if (isMissingFile(error)) return { ok: true, value: undefined };
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /** Resolves `relativePath` under the root, or `undefined` when it escapes it. */
  private resolveInsideRoot(relativePath: string): string | undefined {
    if (relativePath.length === 0) return undefined;
    if (isAbsolute(relativePath)) return undefined;
    if (relativePath.includes("\\")) return undefined;
    if (relativePath.split("/").includes("..")) return undefined;

    const target = resolve(this.root, relativePath);
    // `startsWith(root + sep)` also rejects the root itself (`"."`/`""`).
    if (!target.startsWith(this.root + sep)) return undefined;
    return target;
  }
}

function isMissingFile(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { readonly code?: unknown }).code;
  return code === "ENOENT" || code === "ENOTDIR";
}
