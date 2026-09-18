import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const repoRoot = path.resolve(import.meta.dirname, "../..");

// Credential-gated integration suite: runs `@supabase/supabase-js` against the
// live instance. Kept in a dedicated config (never merged into
// `vitest.config.ts`) so the default `test` script never discovers it.
export default defineConfig(({ mode }) => ({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.integration.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    retry: 0,
    // Live rows share one reserved id range; keep test files from racing
    // each other's writes/cleanup.
    fileParallelism: false,
    // Vitest does not read non-`VITE_`-prefixed vars from `.env` into
    // `process.env` automatically — load them explicitly from the repo root.
    env: loadEnv(mode, repoRoot, "")
  }
}));
