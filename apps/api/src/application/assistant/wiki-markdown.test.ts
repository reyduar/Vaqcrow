import { describe, expect, it } from "vitest";
import { parseWikiIndex, parseWikiPage } from "./wiki-markdown.js";

/**
 * The compiled wiki is corpus, not product (schema.md): these pure parsers read
 * `index.md` into the router's catalogue and one page into the answer prompt.
 * The id and the file name must agree, so a model id that is not in the index
 * can never select a page.
 */
describe("parseWikiIndex", () => {
  const INDEX = [
    "# Índice de la wiki del asistente",
    "",
    "Una línea por página.",
    "",
    "- [revenue-share](revenue-share.md): qué es el revenue share.",
    "- [mi-campana](mi-campana.md): el área de la PyME.",
    "",
    "- [revenue-share](revenue-share.md): duplicado que debe ignorarse."
  ].join("\n");

  it("reads one entry per line, in order, ignoring headings and blanks", () => {
    expect(parseWikiIndex(INDEX)).toEqual([
      { id: "revenue-share", description: "qué es el revenue share." },
      { id: "mi-campana", description: "el área de la PyME." }
    ]);
  });

  it("ignores a line whose link text and file name disagree", () => {
    expect(parseWikiIndex("- [a](b.md): desc")).toEqual([]);
  });

  it("ignores a non-slug id and a line without a description", () => {
    expect(parseWikiIndex("- [Not A Slug](Not-A-Slug.md): desc")).toEqual([]);
    expect(parseWikiIndex("- [revenue-share](revenue-share.md):")).toEqual([]);
  });
});

describe("parseWikiPage", () => {
  const PAGE = [
    "---",
    "title: Revenue share",
    "type: concepto",
    "sources:",
    "  - como-funciona-vaqcrow.md",
    "updated: 2026-10-14",
    "---",
    "",
    "# Revenue share",
    "",
    "El revenue share reparte un porcentaje."
  ].join("\n");

  it("parses the title and strips the front matter from the body", () => {
    const page = parseWikiPage("revenue-share", PAGE);
    expect(page?.title).toBe("Revenue share");
    expect(page?.body).toBe("# Revenue share\n\nEl revenue share reparte un porcentaje.");
    expect(page?.body).not.toContain("---");
    expect(page?.screen).toBeUndefined();
  });

  it("reads the optional screen for a `pantalla` page", () => {
    const raw = "---\ntitle: Mi campaña\ntype: pantalla\nscreen: /company\n---\n\n# Mi campaña";
    expect(parseWikiPage("mi-campana", raw)).toMatchObject({ title: "Mi campaña", screen: "/company" });
  });

  it("returns undefined when there is no title", () => {
    expect(parseWikiPage("x", "# sin front matter")).toBeUndefined();
    expect(parseWikiPage("x", "---\ntype: concepto\n---\n\n# x")).toBeUndefined();
  });
});
