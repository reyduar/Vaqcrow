/**
 * The blog content source (#498/WU2, owner decision D2).
 *
 * The API serves the Markdown: `docs/guides/blog/` is bundled into the API
 * image and read at runtime from disk. The application layer knows only this
 * shape; the filesystem specifics (and the anti-path-traversal guard) live in
 * `infrastructure/adapters/filesystem-blog-content-source.ts`.
 *
 * The result is deliberately three-valued:
 *
 * - `{ ok: true, value: <string> }` — the file was read;
 * - `{ ok: true, value: undefined }` — there is **no such file** (a missing
 *   article, or a `sourcePath` the guard refused to read). The caller decides
 *   what that means; for a published row it is a server-side fault, never a
 *   silent empty article;
 * - `{ ok: false, error: { code: "unavailable" } }` — an I/O failure. Never a
 *   provider `message`; the code is the whole error surface.
 */
export type BlogContentSourceResult =
  | { readonly ok: true; readonly value: string | undefined }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export interface BlogContentSourcePort {
  /**
   * Reads the Markdown at `sourcePath`, a path **relative to `docs/guides/`**.
   * The implementation refuses an absolute path, a backslash or a `..` segment
   * and any path that would resolve outside the guides root (returns
   * `value: undefined` without reading).
   */
  read(sourcePath: string): Promise<BlogContentSourceResult>;
}
