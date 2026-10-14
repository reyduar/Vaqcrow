import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FileSystemWikiRepository, resolveWikiRoot } from "./filesystem-wiki-repository.js";

/**
 * The filesystem wiki repository (#499/WU2). It reads `index.md` and a page by
 * id under the bundled `docs/wiki/` root, refuses — without reading — an id that
 * is not a slug or that would resolve outside the root, and answers a missing
 * file as `value: undefined`.
 */
let tempRoot: string;
let repository: FileSystemWikiRepository;

beforeAll(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "vaqcrow-wiki-"));
  const wikiRoot = join(tempRoot, "wiki");
  await mkdir(wikiRoot, { recursive: true });
  await writeFile(join(wikiRoot, "index.md"), "- [revenue-share](revenue-share.md): desc\n");
  await writeFile(join(wikiRoot, "revenue-share.md"), "---\ntitle: Revenue share\n---\n\nBody\n");
  // A file OUTSIDE the wiki root the guard must never return.
  await writeFile(join(tempRoot, "secret.md"), "SECRET");
  repository = new FileSystemWikiRepository({ wikiRoot });
});

afterAll(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("FileSystemWikiRepository", () => {
  it("reads index.md", async () => {
    expect(await repository.readIndex()).toEqual({ ok: true, value: "- [revenue-share](revenue-share.md): desc\n" });
  });

  it("reads a page by id", async () => {
    expect(await repository.readPage("revenue-share")).toEqual({
      ok: true,
      value: "---\ntitle: Revenue share\n---\n\nBody\n"
    });
  });

  it("answers value: undefined for a missing page", async () => {
    expect(await repository.readPage("no-existe")).toEqual({ ok: true, value: undefined });
  });

  it("refuses a traversal id without reading the file outside the root", async () => {
    const result = await repository.readPage("../secret");
    expect(result).toEqual({ ok: true, value: undefined });
    expect(result.ok && result.value).not.toBe("SECRET");
  });

  it.each(["../secret", "/etc/passwd", "a\\b", "Revenue Share", "a/b"])(
    "refuses a non-slug id: %s",
    async (id) => {
      expect(await repository.readPage(id)).toEqual({ ok: true, value: undefined });
    }
  );
});

describe("resolveWikiRoot", () => {
  it("walks up to the workspace root and returns its docs/wiki directory", () => {
    const root = resolveWikiRoot();
    expect(root.endsWith(join("docs", "wiki"))).toBe(true);
    expect(existsSync(root)).toBe(true);
  });
});
