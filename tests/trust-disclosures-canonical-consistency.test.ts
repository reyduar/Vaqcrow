import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Feature #240 follow-up (review finding R3-CANON-DUP-NO-GUARD).
 *
 * The trust disclosures are duplicated on purpose: the canonical text lives in
 * code and is quoted verbatim by the two documents that own the copy. Feature
 * #240 proved they matched with a one-off shell comparison recorded in its
 * evidence document — which means a later edit could desynchronize the code
 * from the specification with no failing check behind it.
 *
 * That is the drift the demo cannot afford: the interface would say one thing
 * and the document another. This test makes the invariant committed. Every
 * `text:` literal of the canonical record must appear, verbatim, in both
 * documents.
 *
 * The documents wrap the same sentence in markdown emphasis and quote markers,
 * so the comparison normalizes only `**`, `>`, surrounding whitespace and the
 * quote characters a blockquote or an inline quote adds. Anything else is a
 * real difference.
 *
 * `tests/**` runs under `pnpm run test:boundaries` (root `vitest.config.ts`) and
 * sits outside `turbo run lint`/`typecheck`, so this file gets no static
 * analysis — keep it explicit.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const DISCLOSURES_SOURCE = "apps/web/src/application/trust/disclosures.ts";

/** The documents that own the canonical copy: `DEMO.md` §12, `demo-ui.md` §2/§11 and the Claude Design brief §6.2. */
const DOCUMENTS = [
  "docs/planning/DEMO.md",
  "docs/design/demo-ui.md",
  "docs/design/claude-design-brief.md"
] as const;

/** How many canonical disclosures the record is expected to carry. */
const CANONICAL_DISCLOSURE_COUNT = 6;

const read = (relativePath: string) => readFileSync(join(REPO_ROOT, relativePath), "utf8");

const normalize = (value: string) =>
  value
    .replace(/\*\*/g, "")
    .replace(/>/g, "")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Every canonical `text:` literal, read from source rather than imported: the
 * root test project has no path into `apps/web`, and reading the literal also
 * proves the file really carries it. The interface's `readonly text: string;`
 * declaration is not matched — the pattern requires a quoted value.
 */
function canonicalTexts(): string[] {
  const source = read(DISCLOSURES_SOURCE);
  return [...source.matchAll(/^\s*text: "([^"]+)"/gm)].map((match) => match[1] ?? "");
}

describe("trust disclosures: code and documents stay in lockstep", () => {
  it("finds every canonical disclosure text in the source record", () => {
    expect(canonicalTexts()).toHaveLength(CANONICAL_DISCLOSURE_COUNT);
  });

  it.each(DOCUMENTS)("quotes every canonical disclosure verbatim in %s", (documentPath) => {
    const document = normalize(read(documentPath));

    for (const text of canonicalTexts()) {
      expect(document).toContain(normalize(text));
    }
  });
});
