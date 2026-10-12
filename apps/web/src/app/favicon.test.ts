import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Issue #478: every route must show the Vaqcrow isotype as the browser favicon.
 *
 * Next's App Router **file convention** is what makes Next emit the
 * `<link rel="icon">` in the built head for the whole app subtree: a file named
 * `icon.png` next to the root `layout.tsx`. This asserts the convention file is
 * present and is a real PNG — not a JSON placeholder or a renamed text file.
 */
const APP_DIR = dirname(fileURLToPath(import.meta.url));
const ICON_PATH = join(APP_DIR, "icon.png");
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("favicon (#478)", () => {
  it("ships the Next App Router `icon.png` convention file", () => {
    expect(existsSync(ICON_PATH)).toBe(true);
  });

  it("is a real PNG", () => {
    expect(readFileSync(ICON_PATH).subarray(0, 8)).toEqual(PNG_MAGIC);
  });
});
