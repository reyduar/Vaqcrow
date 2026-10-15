import { defineConfig } from "vitest/config";

/**
 * The per-test budget under load (#550, completing #546).
 *
 * Vitest's implicit per-test timeout is 5000 ms of **wall clock**, not CPU, and
 * `pnpm run verify` runs every workspace through turbo concurrently. On a
 * saturated machine a test that passes in isolation can blow that budget and
 * fail spuriously — observed in this suite (`tests/boundaries.test.ts`,
 * `tests/stellar-non-custody.test.ts`) and, before that, in the web suite. The
 * budget is explicit so it is never the framework's silent default, and it stays
 * finite so a real hang still fails.
 */
const LOAD_TOLERANT_TIMEOUT_MS = 15_000;

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: LOAD_TOLERANT_TIMEOUT_MS,
    hookTimeout: LOAD_TOLERANT_TIMEOUT_MS
  }
});
