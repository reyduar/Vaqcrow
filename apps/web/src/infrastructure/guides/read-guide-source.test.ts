import { describe, expect, it } from "vitest";
import { HOW_IT_WORKS_GUIDE, readGuideSource } from "./read-guide-source";

/**
 * The reader is the boundary between the repository's Markdown and the rendered
 * page (`owasp-security` #502, A01): a caller may only name a bare file inside
 * `docs/guides/`, never a path that walks out of it.
 */
describe("readGuideSource", () => {
  it("reads a guide from docs/guides", () => {
    expect(readGuideSource(HOW_IT_WORKS_GUIDE)).toContain("# Cómo funciona Vaqcrow");
  });

  it("refuses anything that is not a bare file name", () => {
    for (const name of ["", "../package.json", "../../etc/passwd", "sub/file.md", "a\\b.md"]) {
      expect(() => readGuideSource(name)).toThrow();
    }
  });
});
