/**
 * The compiled-wiki Markdown readers (#499/WU2).
 *
 * `docs/wiki/schema.md` fixes the shape: `index.md` is one line per page
 * (`- [id](id.md): description`), and a page carries YAML front matter with a
 * `title` and, for a `pantalla` page, a `screen`. These pure readers turn the
 * raw files the repository hands back into the catalogue the router navigates
 * and the page the answer prompt carries. No filesystem, no framework.
 */

export interface WikiIndexEntry {
  readonly id: string;
  readonly description: string;
}

export interface WikiPage {
  readonly id: string;
  readonly title: string;
  /** The app route a `pantalla` page declares (owner decision D10). */
  readonly screen?: string;
  /** The Markdown body, with the front matter stripped. */
  readonly body: string;
}

const FENCE = "---";
/** The id is a slug and the link must resolve to `<id>.md`. */
const INDEX_LINE = /^-\s*\[([^\]]+)\]\(([^)]+)\)\s*:\s*(.+)$/;
const PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Reads `index.md` into the router's catalogue: one entry per page, in the
 * order they appear. A line whose id is not a slug, whose file name disagrees
 * with its id, or that carries no description is dropped — an id the router can
 * return is always one the code accepts.
 */
export function parseWikiIndex(raw: string): readonly WikiIndexEntry[] {
  const entries: WikiIndexEntry[] = [];
  const seen = new Set<string>();

  for (const line of raw.split("\n")) {
    const match = INDEX_LINE.exec(line.trim());
    if (match === null) continue;

    const id = (match[1] ?? "").trim();
    const file = (match[2] ?? "").trim();
    const description = (match[3] ?? "").trim();

    if (!PAGE_SLUG.test(id)) continue;
    if (file !== `${id}.md`) continue;
    if (description === "") continue;
    if (seen.has(id)) continue;

    seen.add(id);
    entries.push({ id, description });
  }

  return entries;
}

/**
 * Reads one page: its `title` and optional `screen`, with the front matter
 * stripped from the body. A page with no `title` is `undefined` — the answer
 * prompt is never built from an untitled page.
 */
export function parseWikiPage(id: string, raw: string): WikiPage | undefined {
  const { values, body } = readFrontMatter(raw);
  const title = values["title"];
  if (title === undefined || title === "") return undefined;

  const screen = values["screen"];
  return screen === undefined || screen === ""
    ? { id, title, body }
    : { id, title, screen, body };
}

/**
 * A minimal front-matter reader for the wiki's scalar keys. Only the leading
 * `---` fence is considered; the body is everything after it. Block-list lines
 * (`  - source.md`) carry no `:` and are ignored, which is all this reader needs
 * (`title` and `screen` are the only keys it reads).
 */
function readFrontMatter(raw: string): {
  readonly values: Readonly<Record<string, string>>;
  readonly body: string;
} {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== FENCE) return { values: {}, body: raw };

  let closeIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === FENCE) {
      closeIndex = index;
      break;
    }
  }
  if (closeIndex === -1) return { values: {}, body: raw };

  const values: Record<string, string> = {};
  for (const line of lines.slice(1, closeIndex)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key !== "" && value !== "" && !key.startsWith("-")) values[key] = stripQuotes(value);
  }

  const rest = lines.slice(closeIndex + 1).join("\n");
  return { values, body: rest.startsWith("\n") ? rest.slice(1) : rest };
}

function stripQuotes(value: string): string {
  if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'")) && value.endsWith(value[0] as string)) {
    return value.slice(1, -1);
  }
  return value;
}
