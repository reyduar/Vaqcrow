/**
 * The blog front-matter parser (#498/WU2, S8).
 *
 * It reads only the leading `---` fence — scalar `key: value` lines and a
 * `tags:` block list (`- item` lines) or an inline `[a, b]` — and ignores every
 * other key (`date`, `status`, …). The returned `body` is the Markdown with the
 * front matter stripped, so the front matter is never rendered as body text.
 * A file with no (or an unterminated) front matter yields the raw text and no
 * tags.
 *
 * Pure: no filesystem, no framework. The Markdown file itself is read by the
 * content-source adapter, not here.
 */

export interface FrontMatterAttributes {
  readonly title?: string;
  /** The `tags:` list, in declaration order; empty when none is declared. */
  readonly tags: readonly string[];
}

export interface ParsedFrontMatter {
  readonly attributes: FrontMatterAttributes;
  readonly body: string;
}

const FENCE = "---";
const LIST_ITEM = /^-\s+(.*)$/;

export function parseFrontMatter(raw: string): ParsedFrontMatter {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== FENCE) return { attributes: { tags: [] }, body: raw };

  let closeIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === FENCE) {
      closeIndex = index;
      break;
    }
  }
  // An unterminated fence is not front matter: keep the file verbatim.
  if (closeIndex === -1) return { attributes: { tags: [] }, body: raw };

  const attributes = parseAttributes(lines.slice(1, closeIndex));
  const rest = lines.slice(closeIndex + 1).join("\n");
  // Drop the single newline that separates the closing fence from the body.
  const body = rest.startsWith("\n") ? rest.slice(1) : rest;

  return { attributes, body };
}

function parseAttributes(lines: readonly string[]): FrontMatterAttributes {
  let title: string | undefined;
  const tags: string[] = [];
  // The key a following `- item` line belongs to (only `tags` is a list here).
  let lastKey: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const listItem = LIST_ITEM.exec(trimmed);
    if (listItem !== null && lastKey === "tags") {
      const tag = stripQuotes(listItem[1]?.trim() ?? "");
      if (tag !== "") tags.push(tag);
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      lastKey = undefined;
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    lastKey = key;

    if (key === "title") {
      if (value !== "") title = stripQuotes(value);
    } else if (key === "tags") {
      if (value === "") continue; // a block list follows
      if (value.startsWith("[") && value.endsWith("]")) {
        for (const item of value.slice(1, -1).split(",")) {
          const tag = stripQuotes(item.trim());
          if (tag !== "") tags.push(tag);
        }
      } else {
        tags.push(stripQuotes(value));
      }
    }
  }

  return title === undefined ? { tags } : { title, tags };
}

/** Removes one matching pair of surrounding quotes, if present. */
function stripQuotes(value: string): string {
  if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'")) && value.endsWith(value[0] as string)) {
    return value.slice(1, -1);
  }
  return value;
}
