import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Feature #438: the scripted six-step journey is retired. Its routes are not
 * redirected (no redirect was decided), so they must simply not exist — Next
 * answers 404 — and nothing in the web app may still link or navigate to them.
 */
const RETIRED_ROUTES = ["/request", "/ai-assessment", "/approval", "/funding", "/distribution", "/evidence"];

const APP_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = dirname(APP_DIR);
const THIS_FILE = fileURLToPath(import.meta.url);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** `app/(demo)/request/page.tsx` → `/request`: route groups and private folders do not add a URL segment. */
function routeOf(pageFile: string): string {
  const segments = relative(APP_DIR, dirname(pageFile))
    .split(sep)
    .filter((segment) => segment !== "" && !/^\(.*\)$/.test(segment));
  return `/${segments.join("/")}`;
}

/**
 * An exact path literal (`"/request"`, `'/funding?x=1'`, `` `/evidence#a` ``).
 * API paths (`/sme-requests`, `` `/application-reviews/${id}/evidence` ``) and
 * nested app paths (`/admin/pymes/.../evidence`) never match: the retired path
 * must start right after the opening quote and end at the closing one, a `?` or a `#`.
 */
const RETIRED_LITERAL = new RegExp(
  `["'\`](${RETIRED_ROUTES.map((route) => route.replace("/", "\\/")).join("|")})(?:[?#][^"'\`]*)?["'\`]`,
  "g"
);

describe("retired scripted journey routes (#438)", () => {
  it("serves no page for any of the six journey paths", () => {
    const routes = walk(APP_DIR)
      .filter((file) => /[/\\]page\.(tsx|ts|jsx|js)$/.test(file))
      .map(routeOf);

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.filter((route) => RETIRED_ROUTES.includes(route))).toEqual([]);
  });

  it("links, navigates or redirects to none of the six journey paths", () => {
    const offenders = walk(SRC_DIR)
      .filter((file) => /\.(tsx?|jsx?|mjs)$/.test(file) && file !== THIS_FILE)
      .flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(RETIRED_LITERAL)].map(
          (match) => `${relative(SRC_DIR, file)}: ${match[0]}`
        )
      );

    expect(offenders).toEqual([]);
  });

  it("recognizes a retired path literal and ignores API and nested paths", () => {
    const matches = (source: string) => [...source.matchAll(RETIRED_LITERAL)].map((match) => match[1]);

    expect(matches(`href="/request"`)).toEqual(["/request"]);
    expect(matches(`router.push('/funding?applicationId=1')`)).toEqual(["/funding"]);
    expect(matches("redirect(`/evidence#vault`)")).toEqual(["/evidence"]);
    expect(matches(`client.post("/sme-requests")`)).toEqual([]);
    expect(matches("`/application-reviews/${id}/evidence`")).toEqual([]);
    expect(matches("`/admin/pymes/${id}/evidence`")).toEqual([]);
    expect(matches(`"/requests"`)).toEqual([]);
  });
});
