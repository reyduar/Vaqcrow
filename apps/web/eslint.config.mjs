import globals from "globals";
import base, { nextWebConfig } from "../../eslint.config.mjs";

export default [
  ...base,
  ...nextWebConfig,
  {
    // The Playwright local double is a plain Node ESM script: it needs Node globals,
    // which the shared base config only grants to `**/*.{ts,tsx}`.
    files: ["e2e/**/*.mjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.node }
  }
];
