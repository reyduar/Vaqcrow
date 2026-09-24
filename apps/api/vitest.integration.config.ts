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
    //
    // `mode` selects the environment profile file: `--mode docker` (the
    // `test:integration:docker` script, and the default `test:integration`)
    // loads `.env.docker`; `--mode cloud` (`test:integration:cloud`) loads
    // `.env.cloud`. See docs/architecture/environments.md. Vite's own
    // layering (`.env`, `.env.local`, then `.env.<mode>[.local]`) still
    // applies, but this repo no longer keeps a root `.env.local` — the file
    // that used to hold these credentials is now `.env.cloud`.
    env: loadEnv(mode, repoRoot, "")
  }
}));
