import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const NEXT_WEB_FILES = ["src/**/*.{ts,tsx}"];

// eslint-config-next's flat configs ship their own `files` globs (e.g. `**/*.{js,jsx,...}`),
// which resolve relative to the *loaded* config file's directory (apps/web/eslint.config.mjs),
// not the repo root. Rescope every rule-bearing entry to `src/**/*.{ts,tsx}` so Next rules only
// ever apply within apps/web. Pure `{ ignores: [...] }` entries stay untouched — adding `files`
// to those would turn a global ignore into a scoped one and stop excluding `.next/**` etc.
export const nextWebConfig = [...nextCoreWebVitals, ...nextTypescript].map((entry) => {
  const isGlobalIgnore = Object.keys(entry).length === 1 && Array.isArray(entry.ignores);
  return isGlobalIgnore ? entry : { ...entry, files: NEXT_WEB_FILES };
});

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.node },
    rules: { "@typescript-eslint/consistent-type-imports": "error", "no-console": "warn" }
  },
  {
    // Node ESM entry points (tooling and scripts). Without this the recommended
    // set flags `process`, `console`, `fetch` and `AbortSignal` as undefined,
    // because the entry above only claims TypeScript files. `no-console` is
    // deliberately not applied: for a CLI script the console is the interface.
    files: ["**/*.mjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.node }
  }
);
