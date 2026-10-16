import { describe, expect, it } from "vitest";
import { ENTREPRENEUR_GUIDE } from "./entrepreneur-guide";
import { INVESTOR_GUIDE } from "./investor-guide";

/**
 * Both guides' worked example names the revenue-share rule. The canonical
 * version is `RS-2026-02` (`packages/domain/src/revenue-share.ts`, fixed by
 * `docs/design/demo-ui.md` §10.2), but `apps/web` may not import `packages/domain`
 * (dependency-cruiser), so it is pinned here as a literal.
 *
 * Both guides carried the template's `rs-v1.2` — a rule version that exists
 * nowhere in the code — until this test was written. A guide citing any other
 * version now fails.
 */
const CANONICAL_RULE_VERSION = "RS-2026-02";

/** Recursively collect every string value, including nested arrays/objects. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

describe("the guides cite the canonical revenue-share rule version", () => {
  it.each([
    ["investor", INVESTOR_GUIDE],
    ["entrepreneur", ENTREPRENEUR_GUIDE]
  ] as const)("names RS-2026-02 in the %s guide, and no other version", (_name, guide) => {
    const text = collectStrings(guide).join("\n");

    expect(text).toContain(CANONICAL_RULE_VERSION);
    expect(text).not.toMatch(/rs-v\d/i);
  });
});
