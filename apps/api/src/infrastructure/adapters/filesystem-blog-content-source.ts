import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import type { BlogContentSourcePort, BlogContentSourceResult } from "../../application/ports/blog-content-source-port.js";

/**
 * The filesystem blog content source (#498/WU2, S7; owner decision D2).
 *
 * The API serves the Markdown: `docs/guides/blog/` is bundled into the API
 * image and read at runtime from disk. Every `source_path` comes from
 * `public.blog_post`, which is database data — treated as hostile. Before any
 * read the path is refused if it is absolute, contains a backslash or a `..`
 * segment, or resolves outside the guides root; a refused path is reported as
 * `value: undefined` and never touches the filesystem. A missing file is also
 * `value: undefined`; any other I/O error is a sanitized `unavailable`.
 */

const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";
const MAX_DEPTH = 10;

/**
 * Walks up from `cwd` until the workspace manifest, then returns that root's
 * `docs/guides` directory. Resolving by the manifest — never by counting `..`
 * levels — keeps the path correct wherever the app runs (a container, a
 * worktree, a nested package).
 */
export function resolveGuidesRoot(cwd: string = process.cwd()): string {
  let directory = cwd;

  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (existsSync(join(directory, WORKSPACE_MANIFEST))) return join(directory, "docs", "guides");
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  throw new Error(`No ${WORKSPACE_MANIFEST} above ${cwd}; cannot resolve docs/guides`);
}

export class FileSystemBlogContentSource implements BlogContentSourcePort {
  private readonly root: string;

  constructor(options: { readonly guidesRoot: string }) {
    this.root = resolve(options.guidesRoot);
  }

  async read(sourcePath: string): Promise<BlogContentSourceResult> {
    const target = this.resolveInsideRoot(sourcePath);
    if (target === undefined) return { ok: true, value: undefined };

    try {
      return { ok: true, value: await readFile(target, "utf8") };
    } catch (error) {
      if (isMissingFile(error)) return { ok: true, value: undefined };
      return { ok: false, error: { code: "unavailable" } };
    }
  }

  /** Resolves `sourcePath` under the root, or `undefined` when it escapes it. */
  private resolveInsideRoot(sourcePath: string): string | undefined {
    if (sourcePath.length === 0) return undefined;
    if (isAbsolute(sourcePath)) return undefined;
    if (sourcePath.includes("\\")) return undefined;
    if (sourcePath.split("/").includes("..")) return undefined;

    const target = resolve(this.root, sourcePath);
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
