import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PUBLIC_COPY_DENYLIST } from "./public-copy-vocabulary";

/**
 * #582 — the assistant's wiki corpus must obey the public-copy denylist.
 *
 * The wiki is corpus, not product (`docs/wiki/schema.md:5-6`): the assistant
 * reads `index.md` to route, reads the chosen pages, and writes a short answer
 * in its own words. A forbidden term in a page or an index line therefore
 * reaches a person even though no wiki text is rendered verbatim.
 *
 * The scan lives here, under root `tests/`, for the reasons in
 * `./public-copy-vocabulary.ts`: `apps/api` may not import from `apps/web`
 * (`.dependency-cruiser.cjs`, `no-cross-app-imports`), and root `tests/` is
 * outside the cruise globs and is where the repo's cross-app scans already
 * live. `tests/wiki-structure.test.ts` is the *structural* half of the wiki
 * contract (types, index ↔ files, front matter); this file is the copy rule
 * over the same corpus, kept separate so each failure stays legible.
 *
 * Scope decision: `apps/web/src/application/trust/disclosures.ts` is **not**
 * scanned here. Its seven texts are the canonical, owner-approved disclosures
 * and are already pinned verbatim to the design documents by
 * `tests/trust-disclosures-canonical-consistency.test.ts`. Their forbidden
 * stems appear only inside deliberate negations — «no constituye … ni prueba
 * de legalidad, rentabilidad, solvencia…», «no … ni disponibilidad en
 * producción» — so putting them through this denylist would either fail on
 * approved copy or force a large exemption list that weakens the guard. The
 * denylist governs claims; the canonical disclosures are the denial of those
 * claims.
 */

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const WIKI_DIR = join(REPO_ROOT, "docs", "wiki");

/**
 * Not corpus: `schema.md` defines how the wiki is written and the assistant
 * never reads it; `log.md` is the wiki's history and may quote an older
 * wording. Every other Markdown file — `index.md` and every page — is corpus.
 */
const NON_CORPUS_FILES = new Set(["schema.md", "log.md"]);

function corpusFiles(): readonly string[] {
  return readdirSync(WIKI_DIR)
    .filter((name) => name.endsWith(".md") && !NON_CORPUS_FILES.has(name))
    .sort();
}

/**
 * Legitimate uses of a denylisted stem in the corpus: explicit denials and one
 * descriptive section heading. Each is declared with the file it lives in and
 * asserted there, so the exemption cannot silently outlive or drift away from
 * the text. Phrases are case-sensitive and keep their Markdown prefix where
 * needed: `## Qué garantiza` scrubs the bóveda heading, never the lowercase
 * index line this task fixes.
 */
const DECLARED_NON_CLAIMS = [
  // A descriptive section heading, not a claim about the product.
  { file: "boveda-soroban.md", phrase: "## Qué garantiza" },
  // An explicit denial: the contribution has no guaranteed return.
  { file: "guia-del-inversor.md", phrase: "no tiene retorno garantizado" },
  // An explicit denial: no production availability is claimed.
  { file: "que-es-real-y-que-es-simulado.md", phrase: "ni disponibilidad en producción" },
  // An explicit denial: the platform does not guarantee funding.
  { file: "guia-para-emprendedores.md", phrase: "no garantiza que la campaña se financie" }
] as const;

/** Removes the declared non-claims that belong to `file` before the scan. */
function scrub(text: string, file: string): string {
  let scrubbed = text;
  for (const claim of DECLARED_NON_CLAIMS) {
    if (claim.file !== file) continue;
    scrubbed = scrubbed.split(claim.phrase).join(" ");
  }
  return scrubbed;
}

describe("docs/wiki public copy (#582)", () => {
  it("keeps every declared non-claim in the file that owns it", () => {
    for (const claim of DECLARED_NON_CLAIMS) {
      const text = readFileSync(join(WIKI_DIR, claim.file), "utf8");
      expect(text, `${claim.file} lost its declared non-claim "${claim.phrase}"`).toContain(
        claim.phrase
      );
    }
  });

  it("carries no prohibited term in any page or index line", () => {
    const offences: string[] = [];

    for (const file of corpusFiles()) {
      const text = readFileSync(join(WIKI_DIR, file), "utf8");
      text.split("\n").forEach((line, index) => {
        const scrubbed = scrub(line, file);
        for (const pattern of PUBLIC_COPY_DENYLIST) {
          if (pattern.test(scrubbed)) {
            offences.push(`${file}:${index + 1} matches ${pattern} — ${line.trim()}`);
          }
        }
      });
    }

    expect(offences, offences.join("\n")).toEqual([]);
  });
});
