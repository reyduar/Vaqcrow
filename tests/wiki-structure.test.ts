import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Feature #499 — the help assistant's compiled wiki (`docs/wiki/`).
 *
 * The contract lives in `docs/wiki/schema.md`: it fixes the five page types,
 * the page front matter, the `index.md` router format and the `log.md`. This
 * test turns the structural half of that contract into a committed invariant,
 * so the wiki cannot silently drift — a page with no `source`, a `pantalla`
 * with no real route, an orphan the index forgot, or front matter that leaked
 * into the body all fail here.
 *
 * It lives under `tests/**`, which runs from the root by `pnpm run test:boundaries`
 * (`vitest.config.ts`) and is covered by `pnpm run lint:tests` and
 * `pnpm run typecheck:tests` (`tsconfig.tests.json`), outside the workspace-only
 * `turbo run lint`/`typecheck`.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const WIKI_DIR = join(REPO_ROOT, "docs", "wiki");
const GUIDES_DIR = join(REPO_ROOT, "docs", "guides");

/** Not pages: the schema itself, the router index and the log. */
const NON_PAGE_FILES = new Set(["schema.md", "index.md", "log.md"]);

/** The five page types of `schema.md` §2. */
const PAGE_TYPES = ["concepto", "flujo", "tecnologia", "pantalla", "limite"] as const;

/**
 * The real app routes a `type: pantalla` page may declare. They come from
 * `apps/web/src/application/navigation/shell-nav.ts` and the route list in
 * `AGENTS.md`/`CLAUDE.md`; `/campaigns/[id]` is the dynamic detail the template
 * links to.
 */
const REAL_SCREENS = [
  "/",
  "/login",
  "/signup",
  "/portfolio",
  "/company",
  "/explore",
  "/campaigns/[id]",
  "/help",
  "/about",
  "/admin"
] as const;

const read = (absolutePath: string) => readFileSync(absolutePath, "utf8");

/** The compiled page files, sorted; everything under `docs/wiki` except the three non-pages. */
function compiledPageSlugs(): string[] {
  return readdirSync(WIKI_DIR)
    .filter((name) => name.endsWith(".md") && !NON_PAGE_FILES.has(name))
    .sort();
}

/** Splits a page into its top front matter block and body; `null` when no block is closed at the top. */
function splitFrontMatter(text: string): { frontMatter: string; body: string } | null {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 3);
  if (end === -1) return null;
  return { frontMatter: text.slice(4, end), body: text.slice(end + 5) };
}

/** Reads a scalar `key: value` from a front matter block (the empty string when absent). */
function scalar(frontMatter: string, key: string): string {
  const match = frontMatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

/** Reads a `key:` followed by `  - item` lines from a front matter block. */
function list(frontMatter: string, key: string): string[] {
  const lines = frontMatter.split("\n");
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start === -1) return [];
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^\s*-\s*(.+?)\s*$/);
    if (match?.[1] === undefined) break;
    items.push(match[1]);
  }
  return items;
}

describe("docs/wiki structure (Feature #499)", () => {
  it("compiles at least one page of every declared type", () => {
    const slugs = compiledPageSlugs();
    expect(slugs.length).toBeGreaterThan(0);

    const types = slugs.map(
      (slug) => scalar(splitFrontMatter(read(join(WIKI_DIR, slug)))?.frontMatter ?? "", "type")
    );
    for (const type of PAGE_TYPES) {
      expect(types, `no page of type "${type}"`).toContain(type);
    }
  });

  it.each(compiledPageSlugs())("%s carries valid front matter", (slug) => {
    const page = splitFrontMatter(read(join(WIKI_DIR, slug)));
    expect(page, `${slug} has no closed front matter block at the top`).not.toBeNull();
    if (page === null) return;

    expect(scalar(page.frontMatter, "title").length, `${slug} has no title`).toBeGreaterThan(0);

    const type = scalar(page.frontMatter, "type");
    expect(PAGE_TYPES as readonly string[], `${slug} declares type "${type}"`).toContain(type);

    const sources = list(page.frontMatter, "sources");
    expect(sources.length, `${slug} has no sources`).toBeGreaterThan(0);
    for (const source of sources) {
      expect(existsSync(join(GUIDES_DIR, source)), `${slug} cites missing source ${source}`).toBe(true);
    }

    if (type === "pantalla") {
      const screen = scalar(page.frontMatter, "screen");
      expect(REAL_SCREENS as readonly string[], `${slug} declares screen "${screen}"`).toContain(screen);
    }
  });

  it("index.md lists exactly the compiled pages", () => {
    const index = read(join(WIKI_DIR, "index.md"));
    const listed = [...index.matchAll(/^-\s*\[([^\]]+)\]\(([^)]+\.md)\)/gm)].flatMap((match) =>
      match[2] === undefined ? [] : [match[2]]
    );

    expect(new Set(listed).size, "index.md lists a page twice").toBe(listed.length);
    expect([...listed].sort()).toEqual(compiledPageSlugs());

    for (const target of listed) {
      expect(existsSync(join(WIKI_DIR, target)), `index.md lists missing file ${target}`).toBe(true);
    }
  });

  it("keeps front matter out of the rendered body", () => {
    for (const slug of compiledPageSlugs()) {
      const page = splitFrontMatter(read(join(WIKI_DIR, slug)));
      expect(page, `${slug} has no closed front matter block`).not.toBeNull();
      if (page === null) continue;

      expect(page.body.trim().length, `${slug} has an empty body`).toBeGreaterThan(0);
      expect(
        /^(title|type|sources|screen|updated):/m.test(page.body),
        `${slug} leaked front matter into the body`
      ).toBe(false);
    }
  });
});
