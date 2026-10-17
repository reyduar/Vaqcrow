import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseWikiIndex, parseWikiPage } from "../../application/assistant/wiki-markdown.js";
import { resolveWikiRoot } from "./filesystem-wiki-repository.js";

/**
 * Lint of the real assistant wiki (`docs/wiki/`, schema §6): every page the
 * index lists exists and parses, every page is listed (no orphans), each page
 * declares a schema type and only cites sources that exist under
 * `docs/guides/`. The router only accepts ids that are in the index, so a page
 * missing from it can never ground an answer.
 */
const WIKI_ROOT = resolveWikiRoot();
const GUIDES_ROOT = join(dirname(WIKI_ROOT), "guides");
const NOT_PAGES = new Set(["index.md", "log.md", "schema.md"]);
const PAGE_TYPES = new Set(["concepto", "flujo", "tecnologia", "pantalla", "limite"]);

const indexIds = parseWikiIndex(readFileSync(join(WIKI_ROOT, "index.md"), "utf8")).map((entry) => entry.id);
const pageFiles = readdirSync(WIKI_ROOT).filter((name) => name.endsWith(".md") && !NOT_PAGES.has(name));

function frontMatter(raw: string): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw);
  return match?.[1] ?? "";
}

describe("assistant wiki corpus (docs/wiki)", () => {
  it("lists every page file in the index, and only existing ones", () => {
    expect([...indexIds].sort()).toEqual(pageFiles.map((name) => name.replace(/\.md$/, "")).sort());
  });

  it("indexes the Freighter + Friendbot walkthrough (#558)", () => {
    expect(indexIds).toContain("freighter-y-friendbot");
  });

  it("indexes the Stellar ecosystem page (#599)", () => {
    expect(indexIds).toContain("ecosistema-stellar");
  });

  it.each(pageFiles)("%s parses, declares a schema type and cites existing guide sources", (name) => {
    const raw = readFileSync(join(WIKI_ROOT, name), "utf8");
    expect(parseWikiPage(name.replace(/\.md$/, ""), raw)).toBeDefined();

    const meta = frontMatter(raw);
    expect(PAGE_TYPES.has(/^type:\s*(\S+)/m.exec(meta)?.[1] ?? "")).toBe(true);

    const sources = [...meta.matchAll(/^\s+-\s+(\S+\.md)\s*$/gm)].map((match) => match[1] ?? "");
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) expect(existsSync(join(GUIDES_ROOT, source)), source).toBe(true);
  });
});
