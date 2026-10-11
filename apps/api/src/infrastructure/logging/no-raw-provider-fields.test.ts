import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for #31/WU3: a diagnostic payload must never re-introduce a
 * raw provider text field (`message` / `details` / `hint`).
 *
 * Why a source scan rather than a behavioural test. The leak is not a runtime
 * value that a unit test's double would observe — it is the *shape* of the
 * object literal an adapter hands to a diagnostic call. A single adapter that
 * copies `error.message` back in is invisible to every port-level test (the
 * returned error is already sanitized) and only shows up in production logs.
 * Scanning the source is what actually pins the invariant.
 *
 * What counts as a diagnostic payload:
 *
 *   - a `console.<level>(...)` call; and
 *   - a call to an internal log helper — a callee whose final name is
 *     `log`-prefixed (`this.log(...)`, `log(...)`, `logProviderError(...)`,
 *     `logUnexpected(...)`). This second class exists because an adapter may
 *     build the payload at the helper call site (`SupabaseAuth` does) while the
 *     actual `console.error` — and therefore a console-only scan — only ever
 *     sees the forwarded `context`.
 *
 * Precision, which matters more than breadth here:
 *
 *   - Comments and string/template literals are blanked before the scan, so a
 *     word like `log(` mentioned in prose or a message string is not a call.
 *   - Legitimate helpers are not matched: the seed CLIs' `print` and the
 *     submission-assessment `log({ event, … })` payload carry no provider text,
 *     and `\blog\w*\(` only matches a callee, not any `log` substring.
 *   - Only the three PostgREST/Storage provider fields are forbidden; closed
 *     fields (`code`, `status`, `statusCode`, `name`, `cause`, `correlationId`,
 *     entity ids) remain allowed — that is the whole point of WU3.
 */

const HERE = resolve(fileURLToPath(import.meta.url), "..");
const INFRASTRUCTURE_ROOT = resolve(HERE, "..");

const DIAGNOSTIC_CALL =
  /console\.(?:log|info|warn|error|debug|trace)\s*\(|\blog\w*\s*\(/g;
const RAW_FIELD = /\b(message|details|hint)\s*:/g;

/** Skips a `"`, `'` or backtick literal, honours `\` escapes, returns the index past it. */
function skipQuoted(source: string, start: number): number {
  const quote = source.charAt(start);
  let i = start + 1;
  while (i < source.length) {
    const ch = source.charAt(i);
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    i += 1;
  }
  return i;
}

/**
 * Blank out comments and string/template literals, keeping newlines, so the
 * scan sees only code tokens. A call — or a forbidden key — hidden in prose or
 * a message string must not count.
 */
function toCode(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source.charAt(i);
    const next = source.charAt(i + 1);

    if (ch === "/" && next === "/") {
      while (i < source.length && source.charAt(i) !== "\n") i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source.charAt(i) === "*" && source.charAt(i + 1) === "/")) {
        if (source.charAt(i) === "\n") out += "\n";
        i += 1;
      }
      i += 2; // past the closing "*/" (or past the end, if unterminated)
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      const end = skipQuoted(source, i);
      out += "_";
      for (let j = i; j < end; j += 1) {
        if (source.charAt(j) === "\n") out += "\n";
      }
      i = end;
      continue;
    }

    out += ch;
    i += 1;
  }
  return out;
}

/** Index of the `)` that closes the `(` at `openIndex` (operates on lexed code). */
function matchingParen(code: string, openIndex: number): number {
  let depth = 0;
  let i = openIndex;
  while (i < code.length) {
    const ch = code.charAt(i);
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return code.length;
}

/** Provider-text keys found in the argument list of every diagnostic call in a file. */
function rawFieldsInDiagnosticPayloads(source: string): string[] {
  const code = toCode(source);
  const offenders: string[] = [];
  DIAGNOSTIC_CALL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DIAGNOSTIC_CALL.exec(code)) !== null) {
    const open = match.index + match[0].length - 1;
    const close = matchingParen(code, open);
    const args = code.slice(open + 1, close);
    // `matchAll` leaves the shared global regex's `lastIndex` untouched.
    for (const key of args.matchAll(RAW_FIELD)) {
      offenders.push(key[1] ?? "?");
    }
    DIAGNOSTIC_CALL.lastIndex = close;
  }
  return offenders;
}

/** Every non-test `.ts` under `apps/api/src/infrastructure`, recursively. */
function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

describe("diagnostic payloads carry no raw provider text (#31/WU3)", () => {
  const files = collectSourceFiles(INFRASTRUCTURE_ROOT);

  it("scans a non-empty set of diagnostic calls, so a green result means something", () => {
    // Guards the guard: a walker that silently found no files would pass every
    // per-file case and prove nothing.
    const calls = files.reduce((total, file) => {
      const matches = toCode(readFileSync(file, "utf8")).match(DIAGNOSTIC_CALL);
      return total + (matches?.length ?? 0);
    }, 0);

    expect(files.length).toBeGreaterThan(0);
    expect(calls).toBeGreaterThan(0);
  });

  for (const file of files) {
    const label = relative(INFRASTRUCTURE_ROOT, file);

    it(`logs only closed fields: ${label}`, () => {
      const offenders = rawFieldsInDiagnosticPayloads(readFileSync(file, "utf8"));

      expect(
        offenders,
        `${label} logs raw provider text (${offenders.join(", ")}); log the closed \`code\` instead`
      ).toEqual([]);
    });
  }
});
