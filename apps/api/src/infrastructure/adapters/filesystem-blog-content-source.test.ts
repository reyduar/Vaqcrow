import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FileSystemBlogContentSource, resolveGuidesRoot } from "./filesystem-blog-content-source.js";

/**
 * The filesystem blog content source (#498/WU2, S7). It reads a file under the
 * guides root and refuses — without reading — an absolute path, a backslash, a
 * `..` segment or anything that would resolve outside the root. A missing file
 * is `value: undefined`; any other I/O error is `unavailable`.
 */
let tempRoot: string;
let source: FileSystemBlogContentSource;

beforeAll(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "vaqcrow-blog-"));
  const guidesRoot = join(tempRoot, "guides");
  await mkdir(join(guidesRoot, "blog"), { recursive: true });
  await writeFile(join(guidesRoot, "blog", "post.md"), "# Hola\n");
  // A file OUTSIDE the guides root the guard must never return.
  await writeFile(join(tempRoot, "secret.md"), "SECRET");
  source = new FileSystemBlogContentSource({ guidesRoot });
});

afterAll(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("FileSystemBlogContentSource", () => {
  it("reads a Markdown file relative to the guides root", async () => {
    expect(await source.read("blog/post.md")).toEqual({ ok: true, value: "# Hola\n" });
  });

  it("answers value: undefined for a missing file", async () => {
    expect(await source.read("blog/missing.md")).toEqual({ ok: true, value: undefined });
  });

  it("refuses a `..` traversal without reading the file outside the root", async () => {
    const result = await source.read("../secret.md");
    expect(result).toEqual({ ok: true, value: undefined });
    expect(result.ok && result.value).not.toBe("SECRET");
  });

  it("refuses a nested `..` traversal", async () => {
    expect(await source.read("blog/../../secret.md")).toEqual({ ok: true, value: undefined });
  });

  it("refuses an absolute path", async () => {
    expect(await source.read("/etc/passwd")).toEqual({ ok: true, value: undefined });
  });

  it("refuses a backslash path", async () => {
    expect(await source.read("a\\b.md")).toEqual({ ok: true, value: undefined });
  });

  it("refuses an empty path", async () => {
    expect(await source.read("")).toEqual({ ok: true, value: undefined });
  });
});

describe("resolveGuidesRoot", () => {
  it("walks up to the workspace root and returns its docs/guides directory", () => {
    const root = resolveGuidesRoot();
    expect(root.endsWith(join("docs", "guides"))).toBe(true);
    expect(existsSync(root)).toBe(true);
  });
});
