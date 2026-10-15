import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The web suite's per-test budget under load (#546).
 *
 * vitest's implicit per-test timeout is 5000 ms of **wall clock**, not CPU, and
 * `pnpm run verify` runs every workspace through turbo concurrently. On a
 * saturated machine a jsdom test that takes ~137 ms alone has been observed to
 * blow that budget and fail spuriously (`reports.test.tsx`, twice) while passing
 * in isolation. `maxWorkers` reduces the contention; this explicit budget
 * removes the spurious failure without silencing a real hang, which still fails
 * at the same finite value.
 */
const LOAD_TOLERANT_TIMEOUT_MS = 15_000;

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    // Caps jsdom workers so the suite needs less headroom while turbo runs the
    // other workspaces' tasks in parallel.
    maxWorkers: 4,
    // Explicit, never vitest's implicit 5 s default (see the note above).
    testTimeout: LOAD_TOLERANT_TIMEOUT_MS,
    hookTimeout: LOAD_TOLERANT_TIMEOUT_MS,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"]
  }
});
