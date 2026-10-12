import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Issue #479: every enabled button and button-like control shows the pointer
 * (hand) cursor, and a disabled control never does.
 *
 * jsdom does not apply Tailwind, so the rendered cursor cannot be asserted
 * here. This guards the rule's **presence** in the web global stylesheet — the
 * one place the behaviour lives — so it cannot be deleted by accident. The
 * rendered result is checked on the built CSS and in the browser.
 */
const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "globals.css"), "utf8");

describe("pointer cursor (#479)", () => {
  it("sets the pointer cursor for enabled buttons and button-like controls", () => {
    expect(CSS).toContain("@layer base {");
    expect(CSS).toMatch(/button:not\(:disabled\)[^{]*\{[^}]*cursor:\s*pointer/);
    expect(CSS).toContain('[role="button"]:not([aria-disabled="true"])');
    expect(CSS).toMatch(/summary\s*\{/);
  });

  it("never gives the hand cursor to a disabled control", () => {
    expect(CSS).toMatch(/button:disabled[^{]*\{[^}]*cursor:\s*not-allowed/);
  });
});
