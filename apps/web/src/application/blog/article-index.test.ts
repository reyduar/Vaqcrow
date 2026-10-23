import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import GithubSlugger from "github-slugger";
import { describe, expect, it } from "vitest";

/**
 * The in-article index must resolve on the rendered Blog page, not only in an
 * editor (#617).
 *
 * `rehype-slug` gives every heading the GitHub-style `id` its text slugifies
 * to, and `MarkdownBody` keeps that plugin, so an entry
 * `- [Título](#titulo)` only works if the anchor equals the slug of a real
 * heading. This test reads the article source and enforces exactly that: it
 * fails the moment a section is renamed, removed or duplicated without the
 * index following, which is the way a table of contents rots.
 *
 * The guides root is resolved by walking up to the workspace manifest, never by
 * counting `..` levels, mirroring `read-guide-source.ts` and the public-copy
 * scan.
 */

const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";
const ARTICLE = "react-essentials.md";

function readBlogArticle(fileName: string, from: string = process.cwd()): string {
  let directory = from;
  let root: string | undefined;
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(directory, WORKSPACE_MANIFEST))) {
      root = directory;
      break;
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  if (root === undefined) {
    throw new Error(`No ${WORKSPACE_MANIFEST} above ${from}; cannot resolve docs/guides/blog`);
  }
  return readFileSync(join(root, "docs", "guides", "blog", fileName), "utf8");
}

/** Every `##`/`###` heading slug, computed the way `rehype-slug` computes it. */
function headingSlugs(markdown: string): Map<string, string> {
  const slugger = new GithubSlugger();
  const slugs = new Map<string, string>();
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (match === null) continue;
    const rawTitle = match[2];
    if (rawTitle === undefined) continue;
    const title = rawTitle.replace(/`/g, "");
    slugs.set(slugger.slug(title), title);
  }
  return slugs;
}

/** Every `- [texto](#ancla)` index entry. */
function indexAnchors(markdown: string): { readonly text: string; readonly anchor: string }[] {
  return [...markdown.matchAll(/^\s*- \[(.+?)\]\(#(.+?)\)$/gm)].flatMap((match) => {
    const [, text, anchor] = match;
    if (text === undefined || anchor === undefined) return [];
    return [{ text, anchor }];
  });
}

describe("React Essentials in-article index", () => {
  const article = readBlogArticle(ARTICLE);

  it("points every index entry at a heading that exists", () => {
    const slugs = headingSlugs(article);
    const entries = indexAnchors(article);

    expect(entries.length).toBeGreaterThan(0);

    const dead = entries.filter((entry) => !slugs.has(entry.anchor));
    expect(dead.map((entry) => `${entry.text} -> #${entry.anchor}`)).toEqual([]);
  });

  it("indexes every section except the index itself and the closing blocks", () => {
    const slugs = headingSlugs(article);
    const indexed = new Set(indexAnchors(article).map((entry) => entry.anchor));
    const notIndexedByDesign = new Set(["índice", "cierre", "autoría"]);

    const missing = [...slugs.keys()].filter(
      (slug) => !indexed.has(slug) && !notIndexedByDesign.has(slug)
    );
    expect(missing).toEqual([]);
  });

  it("keeps heading slugs unique so two sections cannot share one anchor", () => {
    const slugs = headingSlugs(article);
    const titles = [...slugs.values()];
    expect(new Set(titles).size).toBe(titles.length);
  });
});
