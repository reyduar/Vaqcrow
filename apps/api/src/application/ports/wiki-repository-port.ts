/**
 * The compiled wiki repository (#499/WU2, owner decision D2).
 *
 * The assistant reads a Karpathy-style compiled wiki that lives in
 * `docs/wiki/`: it is bundled into the API image and read from disk at runtime.
 * The application layer knows only this shape; the filesystem specifics (and
 * the anti-path-traversal guard) live in
 * `infrastructure/adapters/filesystem-wiki-repository.ts`.
 *
 * The result is deliberately three-valued, mirroring the blog content source:
 *
 * - `{ ok: true, value: <string> }` — the file was read;
 * - `{ ok: true, value: undefined }` — there is **no such file** (a missing
 *   page, or an id the guard refused to read). A missing `index.md` or a routed
 *   page is a server-side fault, never a silent empty answer;
 * - `{ ok: false, error: { code: "unavailable" } }` — an I/O failure.
 */
export type WikiRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export interface WikiRepositoryPort {
  /** Reads `index.md` verbatim — the only file the router always reads. */
  readIndex(): Promise<WikiRepositoryResult<string | undefined>>;

  /**
   * Reads one page's Markdown by its **id** (the slug, e.g. `revenue-share`).
   * The implementation refuses an id that is not a slug and any id that would
   * resolve outside the wiki root, returning `value: undefined` without reading.
   */
  readPage(id: string): Promise<WikiRepositoryResult<string | undefined>>;
}
