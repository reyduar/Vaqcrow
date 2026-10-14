import { describe, expect, it } from "vitest";
import { parseFrontMatter } from "./front-matter.js";

/**
 * The blog front-matter parser (#498/WU2, S8). It reads only the leading `---`
 * fence: the `title` scalar, a `tags` block list (`- item`) or an inline
 * `[a, b]`, and it ignores every other key. The returned `body` has the front
 * matter stripped, so it is never rendered as text.
 */
describe("parseFrontMatter", () => {
  it("returns the raw body and no tags when there is no front matter", () => {
    const raw = "# Hola\n\nTexto con un --- guion.";
    expect(parseFrontMatter(raw)).toEqual({ attributes: { tags: [] }, body: raw });
  });

  it("parses a title and a block-list of tags, ignoring other keys", () => {
    const raw = [
      "---",
      "title: Vaqcrow: el producto",
      "tags:",
      "  - stellar",
      "  - soroban",
      "date: 2026-10-14",
      "status: draft",
      "---",
      "",
      "# Cuerpo",
      "",
      "Más texto."
    ].join("\n");

    expect(parseFrontMatter(raw)).toEqual({
      attributes: { title: "Vaqcrow: el producto", tags: ["stellar", "soroban"] },
      body: "# Cuerpo\n\nMás texto."
    });
  });

  it("parses inline tags", () => {
    const raw = "---\ntitle: X\ntags: [a, b, c]\n---\nBody";
    expect(parseFrontMatter(raw).attributes.tags).toEqual(["a", "b", "c"]);
  });

  it("returns no tags when front matter declares none", () => {
    const raw = "---\ntitle: X\n---\nBody";
    expect(parseFrontMatter(raw)).toEqual({ attributes: { title: "X", tags: [] }, body: "Body" });
  });

  it("treats an unterminated fence as no front matter", () => {
    const raw = "---\ntitle: X\nno closing fence";
    expect(parseFrontMatter(raw)).toEqual({ attributes: { tags: [] }, body: raw });
  });

  it("strips a matching pair of quotes around a value", () => {
    expect(parseFrontMatter('---\ntitle: "X: Y"\n---\nBody').attributes.title).toBe("X: Y");
  });

  it("yields an empty body when the front matter ends the file", () => {
    expect(parseFrontMatter("---\ntitle: X\n---").body).toBe("");
  });
});
