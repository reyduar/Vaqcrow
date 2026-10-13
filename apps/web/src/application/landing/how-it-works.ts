/**
 * «La traza» — the landing's end-to-end 「Cómo funciona」 section (#497).
 *
 * The words are not typed here: they are authored once in
 * `docs/guides/como-funciona-vaqcrow.md` and read at build time (owner
 * decision, 2026-10-13: the document is the single source for the landing, the
 * help centre and the assistant's corpus). This module owns the *pure* half —
 * parsing that document — and the presentation-free metadata the document does
 * not carry: which stage is a linear step, which is the All-or-Nothing fork and
 * which is one of its two branches.
 *
 * The document and {@link HOW_IT_WORKS_KINDS} are tied **by order**. A test pins
 * both (titles and kinds) so a reordered or reworded document fails in CI
 * instead of silently rendering the wrong badge.
 *
 * Pure by design: a function of its input, no `fs` (the read lives in
 * `infrastructure/guides/`), no React, no tokens.
 */

export type StationKind = "step" | "fork" | "branch";

export interface HowItWorksStation {
  readonly title: string;
  /** Body paragraphs, in document order; no markup, already unwrapped. */
  readonly body: readonly string[];
}

export interface HowItWorks {
  /** The paragraphs before the first `##`, used as the section's lead. */
  readonly lead: readonly string[];
  readonly stations: readonly HowItWorksStation[];
}

/**
 * One entry per `##` section of `docs/guides/como-funciona-vaqcrow.md`, in the
 * same order. The two branches at the end of the vault's fork are `branch`; the
 * stage that states the All-or-Nothing rule is `fork`.
 */
export const HOW_IT_WORKS_KINDS: readonly StationKind[] = Object.freeze([
  "step", // 01 La PyME crea su cuenta
  "step", // 02 Registra la PyME y sube los documentos
  "step", // 03 La IA evalúa los documentos
  "step", // 04 La PyME conecta Freighter
  "step", // 05 Una persona aprueba
  "step", // 06 La bóveda se despliega en Testnet
  "step", // 07 La campaña se publica
  "step", // 08 El inversor entra y conecta su wallet
  "step", // 09 El inversor aporta
  "fork", // 10 La meta: todo o nada
  "branch", // 11 Meta alcanzada: la PyME recibe el capital
  "branch", // 12 Sin meta: reembolso a los contribuyentes
  "step" // 13 La distribución mensual del revenue share
]);

const FRONTMATTER_FENCE = /^---\s*$/;
const H1 = /^#\s+\S/;
const H2 = /^##\s+\S/;
const BLOCKQUOTE = /^>/;
const H2_PREFIX = /^##\s+/;

/**
 * The inline markup the guide uses: `**strong**` and `` `code` ``. The section
 * turns these into React elements — never into HTML — so the document can carry
 * emphasis without opening an untrusted-markup surface.
 */
export interface InlineSpan {
  readonly text: string;
  readonly kind: "text" | "strong" | "code";
}

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*/g;

/** Splits one paragraph into plain, strong and code spans. */
export function parseInline(text: string): readonly InlineSpan[] {
  const spans: InlineSpan[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > cursor) spans.push({ text: text.slice(cursor, at), kind: "text" });

    if (match[1] !== undefined) {
      spans.push({ text: match[1], kind: "code" });
    } else if (match[2] !== undefined) {
      spans.push({ text: match[2], kind: "strong" });
    }

    cursor = at + match[0].length;
  }

  if (cursor < text.length) spans.push({ text: text.slice(cursor), kind: "text" });

  return spans;
}

/** The line after a leading `---` block, or `0` when there is none. */
function afterFrontmatter(lines: readonly string[]): number {
  if (!FRONTMATTER_FENCE.test(lines[0] ?? "")) return 0;
  const closing = lines.findIndex((line, index) => index > 0 && FRONTMATTER_FENCE.test(line));
  return closing === -1 ? 0 : closing + 1;
}

/**
 * Parses the guide into its lead and its `##` sections. Frontmatter, the H1,
 * blockquotes and horizontal rules are dropped; blank lines separate
 * paragraphs; a wrapped paragraph is joined with single spaces.
 */
export function parseHowItWorks(markdown: string): HowItWorks {
  const lines = markdown.split(/\r?\n/);
  const lead: string[] = [];
  const stations: { title: string; body: string[] }[] = [];
  let paragraph: string[] = [];

  const commit = (): void => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (text.length === 0) return;

    const current = stations[stations.length - 1];
    if (current === undefined) {
      lead.push(text);
    } else {
      current.body.push(text);
    }
  };

  for (let index = afterFrontmatter(lines); index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (H1.test(line) || BLOCKQUOTE.test(line) || FRONTMATTER_FENCE.test(line)) {
      commit();
      continue;
    }

    if (H2.test(line)) {
      commit();
      stations.push({ title: line.replace(H2_PREFIX, "").trim(), body: [] });
      continue;
    }

    if (line.trim().length === 0) {
      commit();
      continue;
    }

    paragraph.push(line.trim());
  }

  commit();

  return { lead, stations };
}
